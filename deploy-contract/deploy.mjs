import * as StellarSDK from "@stellar/stellar-sdk";
import fs from "fs";

const server = new StellarSDK.rpc.Server(
  "https://soroban-testnet.stellar.org:443",
);

const sourceSecret = process.env.BOB_SECRET;
if (!sourceSecret) {
  throw new Error("Missing BOB_SECRET environment variable.");
}

const sourceKeypair = StellarSDK.Keypair.fromSecret(sourceSecret);

// sửa đường dẫn này nếu cần
const wasmFilePath =
  "../contracts/chapter-unlock/target/wasm32v1-none/release/hello_world.wasm";

async function buildAndSendTransaction(account, operation) {
  const transaction = new StellarSDK.TransactionBuilder(account, {
    fee: StellarSDK.BASE_FEE,
    networkPassphrase: StellarSDK.Networks.TESTNET,
  })
    .addOperation(operation)
    .setTimeout(30)
    .build();

  const prepared = await server.prepareTransaction(transaction);
  prepared.sign(sourceKeypair);

  console.log("Submitting transaction...");
  let response = await server.sendTransaction(prepared);
  const hash = response.hash;
  console.log(`Transaction hash: ${hash}`);
  console.log("Awaiting confirmation...");

  while (true) {
    response = await server.getTransaction(hash);
    if (response.status !== "NOT_FOUND") break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  if (response.status === "SUCCESS") {
    console.log("Transaction successful.");
    return response;
  }

  console.log("Transaction failed.");
  throw new Error(JSON.stringify(response, null, 2));
}

async function uploadWasm(filePath) {
  const bytecode = fs.readFileSync(filePath);
  const account = await server.getAccount(sourceKeypair.publicKey());
  const operation = StellarSDK.Operation.uploadContractWasm({ wasm: bytecode });
  return await buildAndSendTransaction(account, operation);
}

async function deployContract(uploadResponse) {
  const account = await server.getAccount(sourceKeypair.publicKey());

  const operation = StellarSDK.Operation.createCustomContract({
    wasmHash: uploadResponse.returnValue.bytes(),
    address: StellarSDK.Address.fromString(sourceKeypair.publicKey()),
    salt: uploadResponse.hash,
  });

  const deployResponse = await buildAndSendTransaction(account, operation);

  const contractAddress = StellarSDK.StrKey.encodeContract(
    StellarSDK.Address.fromScAddress(deployResponse.returnValue.address()).toBuffer(),
  );

  console.log("Contract deployed successfully.");
  console.log("Contract Address:", contractAddress);
}

try {
  const uploadResponse = await uploadWasm(wasmFilePath);
  await deployContract(uploadResponse);
} catch (error) {
  console.error("Deploy error:");
  console.error(error);
}