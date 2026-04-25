import * as StellarSDK from "@stellar/stellar-sdk";
import fs from "fs";

const server = new StellarSDK.rpc.Server(
  "https://soroban-testnet.stellar.org:443"
);

const sourceSecret = process.env.BOB_SECRET;
if (!sourceSecret) {
  throw new Error("Missing BOB_SECRET environment variable.");
}

const sourceKeypair = StellarSDK.Keypair.fromSecret(sourceSecret);

const chapterWasmPath =
  "../contracts/chapter-unlock/target/wasm32v1-none/release/hello_world.wasm";

const tokenWasmPath =
  "../contracts/chapter-unlock/target/wasm32v1-none/release/chapter_token.wasm";

const outputJsonPath = "../public/contracts.json";

async function waitForTx(hash) {
  while (true) {
    const response = await server.getTransaction(hash);
    if (response.status !== "NOT_FOUND") return response;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

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

  response = await waitForTx(hash);

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

  return StellarSDK.StrKey.encodeContract(
    StellarSDK.Address.fromScAddress(deployResponse.returnValue.address()).toBuffer()
  );
}

async function invokeContract(contractId, functionName, args) {
  const account = await server.getAccount(sourceKeypair.publicKey());

  const tx = new StellarSDK.TransactionBuilder(account, {
    fee: StellarSDK.BASE_FEE,
    networkPassphrase: StellarSDK.Networks.TESTNET,
  })
    .addOperation(
      StellarSDK.Operation.invokeContractFunction({
        contract: contractId,
        function: functionName,
        args,
      })
    )
    .setTimeout(30)
    .build();

  const prepared = await server.prepareTransaction(tx);
  prepared.sign(sourceKeypair);

  const sendResponse = await server.sendTransaction(prepared);
  const finalResponse = await waitForTx(sendResponse.hash);

  if (finalResponse.status !== "SUCCESS") {
    throw new Error(
      `Invoke failed for ${functionName}: ${JSON.stringify(finalResponse, null, 2)}`
    );
  }

  console.log(`${functionName} success: ${sendResponse.hash}`);
  return sendResponse.hash;
}

function writeContractsJson(data) {
  fs.writeFileSync(outputJsonPath, JSON.stringify(data, null, 2), "utf-8");
}

function verifyContractsJson() {
  if (!fs.existsSync(outputJsonPath)) {
    throw new Error(`contracts.json was not created at ${outputJsonPath}`);
  }

  const raw = fs.readFileSync(outputJsonPath, "utf-8");
  const parsed = JSON.parse(raw);

  if (!parsed.chapter_contract_id || !parsed.token_contract_id) {
    throw new Error("contracts.json is missing contract ids");
  }

  return parsed;
}

async function main() {
  console.log("Deploying token contract...");
  const tokenUpload = await uploadWasm(tokenWasmPath);
  const tokenContractId = await deployContract(tokenUpload);
  console.log(`Token Contract Address: "${tokenContractId}"`);

  console.log("Deploying chapter contract...");
  const chapterUpload = await uploadWasm(chapterWasmPath);
  const chapterContractId = await deployContract(chapterUpload);
  console.log(`Chapter Contract Address: "${chapterContractId}"`);

  console.log("Initializing token contract...");
  const tokenInitHash = await invokeContract(tokenContractId, "initialize", [
    StellarSDK.nativeToScVal(sourceKeypair.publicKey(), { type: "address" }),
    StellarSDK.nativeToScVal("Coins", { type: "string" }),
    StellarSDK.nativeToScVal("COINS", { type: "string" }),
    StellarSDK.nativeToScVal(0, { type: "u32" }),
  ]);

  console.log("Initializing chapter contract...");
  const chapterInitHash = await invokeContract(chapterContractId, "initialize", [
    StellarSDK.nativeToScVal(sourceKeypair.publicKey(), { type: "address" }),
    StellarSDK.nativeToScVal(tokenContractId, { type: "address" }),
    StellarSDK.nativeToScVal(BigInt(5), { type: "i128" }),
  ]);

  const output = {
    token_contract_id: tokenContractId,
    chapter_contract_id: chapterContractId,
    price_per_chapter: 5,
    token_init_hash: tokenInitHash,
    chapter_init_hash: chapterInitHash,
  };

  writeContractsJson(output);
  const verified = verifyContractsJson();

  console.log("\n=== LEVEL 4 DEPLOY COMPLETE ===");
  console.log(`TOKEN_CONTRACT_ID="${tokenContractId}"`);
  console.log(`CHAPTER_CONTRACT_ID="${chapterContractId}"`);
  console.log(`TOKEN_INIT_HASH="${tokenInitHash}"`);
  console.log(`CHAPTER_INIT_HASH="${chapterInitHash}"`);
  console.log("PRICE = 5");
  console.log(`Saved addresses to ${outputJsonPath}`);
  console.log("Verified contracts.json:");
  console.log(JSON.stringify(verified, null, 2));
}

main().catch((error) => {
  console.error("Deploy error:");
  console.error(error);
});