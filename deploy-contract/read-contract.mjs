import * as StellarSDK from "@stellar/stellar-sdk";
import fs from "fs";

const server = new StellarSDK.rpc.Server(
  "https://soroban-testnet.stellar.org:443"
);

const configPath = "../public/contracts.json";
const USER_ADDRESS =
  "GB2B26HOLR6YWFYT47SWODN5DNJPC7DW22U7HOKOLUZ6KGBC7LEVCIFR";

function loadContractsConfig() {
  const raw = fs.readFileSync(configPath, "utf-8");
  const data = JSON.parse(raw);

  return {
    chapterContractId: (data.chapter_contract_id || "").trim(),
    tokenContractId: (data.token_contract_id || "").trim(),
  };
}

async function simulateCall(contractId, functionName, args) {
  const account = await server.getAccount(USER_ADDRESS);

  const transaction = new StellarSDK.TransactionBuilder(account, {
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

  const prepared = await server.prepareTransaction(transaction);
  const response = await server.simulateTransaction(prepared);

  if (response.result && response.result.retval) {
    return StellarSDK.scValToNative(response.result.retval);
  }

  return null;
}

async function main() {
  try {
    const { chapterContractId, tokenContractId } = loadContractsConfig();

    console.log("Using chapter contract:", chapterContractId);
    console.log("Using token contract:", tokenContractId);

    const unlockedCount = await simulateCall(
      chapterContractId,
      "get_unlocked_count",
      [StellarSDK.nativeToScVal(USER_ADDRESS, { type: "address" })]
    );

    const pricePerChapter = await simulateCall(
      chapterContractId,
      "get_price_per_chapter",
      []
    );

    const totalPriceFor3 = await simulateCall(
      chapterContractId,
      "get_total_price",
      [StellarSDK.nativeToScVal(3, { type: "u32" })]
    );

    const coinsBalance = await simulateCall(tokenContractId, "balance", [
      StellarSDK.nativeToScVal(USER_ADDRESS, { type: "address" }),
    ]);

    console.log("Unlocked chapters:", String(unlockedCount ?? 0).replace(/n$/, ""));
    console.log("Price per chapter:", String(pricePerChapter ?? 0).replace(/n$/, ""));
    console.log("Total price for 3 chapters:", String(totalPriceFor3 ?? 0).replace(/n$/, ""));
    console.log("Coins balance:", String(coinsBalance ?? 0).replace(/n$/, ""));
  } catch (error) {
    console.error("Read contract error:");
    console.error(error);
  }
}

main();