import * as StellarSDK from "@stellar/stellar-sdk";

const server = new StellarSDK.rpc.Server(
  "https://soroban-testnet.stellar.org:443"
);

const contractId =
  "CCBWBFEG67MI42R4JTCZTPKM3M73H7IN2LY4FRIGPARNFCRPIGTTZPMR";

const userAddress =
  "GB2B26HOLR6YWFYT47SWODN5DNJPC7DW22U7HOKOLUZ6KGBC7LEVCIFR";

async function main() {
  try {
    const account = await server.getAccount(userAddress);

    const transaction = new StellarSDK.TransactionBuilder(account, {
      fee: StellarSDK.BASE_FEE,
      networkPassphrase: StellarSDK.Networks.TESTNET,
    })
      .addOperation(
        StellarSDK.Operation.invokeContractFunction({
          contract: contractId,
          function: "is_unlocked",
          args: [StellarSDK.Address.fromString(userAddress).toScVal()],
        })
      )
      .setTimeout(30)
      .build();

    const prepared = await server.prepareTransaction(transaction);

    const response = await server.simulateTransaction(prepared);

    console.log("Raw response:");
    console.log(response);

    if (response.result && response.result.retval) {
      const value = StellarSDK.scValToNative(response.result.retval);
      console.log("Unlocked status:", value);
    } else {
      console.log("No return value found.");
    }
  } catch (error) {
    console.error("Read contract error:");
    console.error(error);
  }
}

main();