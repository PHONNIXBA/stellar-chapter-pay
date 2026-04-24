import * as StellarSDK from "@stellar/stellar-sdk";

const server = new StellarSDK.rpc.Server(
  "https://soroban-testnet.stellar.org:443"
);

const sourceSecret = process.env.BOB_SECRET;
if (!sourceSecret) {
  throw new Error("Missing BOB_SECRET environment variable.");
}

const sourceKeypair = StellarSDK.Keypair.fromSecret(sourceSecret);

const contractId =
  "CCBWBFEG67MI42R4JTCZTPKM3M73H7IN2LY4FRIGPARNFCRPIGTTZPMR";

const userAddress =
  "GB2B26HOLR6YWFYT47SWODN5DNJPC7DW22U7HOKOLUZ6KGBC7LEVCIFR";

async function main() {
  try {
    const account = await server.getAccount(sourceKeypair.publicKey());

    const transaction = new StellarSDK.TransactionBuilder(account, {
      fee: StellarSDK.BASE_FEE,
      networkPassphrase: StellarSDK.Networks.TESTNET,
    })
      .addOperation(
        StellarSDK.Operation.invokeContractFunction({
          contract: contractId,
          function: "unlock",
          args: [StellarSDK.Address.fromString(userAddress).toScVal()],
        })
      )
      .setTimeout(30)
      .build();

    const prepared = await server.prepareTransaction(transaction);
    prepared.sign(sourceKeypair);

    console.log("Submitting unlock transaction...");

    let sendResponse = await server.sendTransaction(prepared);
    const txHash = sendResponse.hash;

    console.log("Transaction hash:", txHash);
    console.log("Waiting for confirmation...");

    while (true) {
      const getResponse = await server.getTransaction(txHash);

      if (getResponse.status === "SUCCESS") {
        console.log("Unlock transaction successful.");
        console.log(getResponse);
        break;
      }

      if (getResponse.status === "FAILED") {
        console.log("Unlock transaction failed.");
        console.log(getResponse);
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  } catch (error) {
    console.error("Unlock contract error:");
    console.error(error);
  }
}

main();