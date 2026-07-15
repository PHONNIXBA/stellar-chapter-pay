import { signTransaction } from "@stellar/freighter-api";
import * as StellarSDK from "@stellar/stellar-sdk";

import { STELLAR_NETWORK } from "../contractConfig";

const DEFAULT_POLL_INTERVAL_MS = 1200;
const DEFAULT_MAX_POLLS = 60;

export function createRpcServer() {
  return new StellarSDK.rpc.Server(
    STELLAR_NETWORK.rpcUrl
  );
}

export function addressToScVal(address) {
  if (!address) {
    throw new Error(
      "A Stellar address is required."
    );
  }

  return StellarSDK.nativeToScVal(
    address,
    { type: "address" }
  );
}

export function u32ToScVal(value) {
  const normalizedValue = Number(value);

  if (
    !Number.isInteger(normalizedValue) ||
    normalizedValue < 0
  ) {
    throw new Error(
      "A valid unsigned integer is required."
    );
  }

  return StellarSDK.nativeToScVal(
    normalizedValue,
    { type: "u32" }
  );
}

export function normalizeContractValue(
  value,
  fallback = "0"
) {
  if (
    value === null ||
    value === undefined
  ) {
    return fallback;
  }

  const normalizedValue = String(value)
    .replace(/n$/, "");

  return normalizedValue || fallback;
}

function validateInvocation({
  contractId,
  functionName,
  source,
}) {
  if (!contractId) {
    throw new Error(
      "Contract ID is required."
    );
  }

  if (!functionName) {
    throw new Error(
      "Contract function name is required."
    );
  }

  if (!source) {
    throw new Error(
      "Source wallet address is required."
    );
  }
}

function createInvocationTransaction({
  account,
  contractId,
  functionName,
  args,
}) {
  const contract = new StellarSDK.Contract(
    contractId
  );

  return new StellarSDK.TransactionBuilder(
    account,
    {
      fee: StellarSDK.BASE_FEE,
      networkPassphrase:
        STELLAR_NETWORK.networkPassphrase,
    }
  )
    .addOperation(
      contract.call(
        functionName,
        ...args
      )
    )
    .setTimeout(30)
    .build();
}

function wait(delayMs) {
  return new Promise((resolve) => {
    globalThis.setTimeout(
      resolve,
      delayMs
    );
  });
}

export async function simulateContractCall({
  server = createRpcServer(),
  contractId,
  functionName,
  args = [],
  source,
}) {
  validateInvocation({
    contractId,
    functionName,
    source,
  });

  const account = await server.getAccount(
    source
  );

  const transaction =
    createInvocationTransaction({
      account,
      contractId,
      functionName,
      args,
    });

  const simulation =
    await server.simulateTransaction(
      transaction
    );

  if (simulation.error) {
    throw new Error(
      String(simulation.error)
    );
  }

  if (
    simulation.result &&
    simulation.result.retval
  ) {
    return StellarSDK.scValToNative(
      simulation.result.retval
    );
  }

  return null;
}

export async function waitForTransaction({
  server,
  transactionHash,
  pollIntervalMs =
    DEFAULT_POLL_INTERVAL_MS,
  maxPolls = DEFAULT_MAX_POLLS,
}) {
  for (
    let attempt = 0;
    attempt < maxPolls;
    attempt += 1
  ) {
    const response =
      await server.getTransaction(
        transactionHash
      );

    if (response.status === "SUCCESS") {
      return response;
    }

    if (response.status === "FAILED") {
      throw new Error(
        "Transaction failed on Stellar Testnet."
      );
    }

    await wait(pollIntervalMs);
  }

  throw new Error(
    "Transaction confirmation timed out."
  );
}

export async function invokeSignedContract({
  server = createRpcServer(),
  contractId,
  functionName,
  args = [],
  walletAddress,
  onSubmitted,
}) {
  validateInvocation({
    contractId,
    functionName,
    source: walletAddress,
  });

  const account = await server.getAccount(
    walletAddress
  );

  const transaction =
    createInvocationTransaction({
      account,
      contractId,
      functionName,
      args,
    });

  const preparedTransaction =
    await server.prepareTransaction(
      transaction
    );

  const signedResult =
    await signTransaction(
      preparedTransaction.toXDR(),
      {
        networkPassphrase:
          STELLAR_NETWORK.networkPassphrase,
        address: walletAddress,
      }
    );

  if (
    signedResult.error ||
    !signedResult.signedTxXdr
  ) {
    throw new Error(
      "Transaction signing was cancelled or rejected."
    );
  }

  const signedTransaction =
    StellarSDK.TransactionBuilder.fromXDR(
      signedResult.signedTxXdr,
      STELLAR_NETWORK.networkPassphrase
    );

  const sendResponse =
    await server.sendTransaction(
      signedTransaction
    );

  if (!sendResponse.hash) {
    throw new Error(
      "Stellar RPC did not return a transaction hash."
    );
  }

  if (
    typeof onSubmitted === "function"
  ) {
    onSubmitted(sendResponse.hash);
  }

  await waitForTransaction({
    server,
    transactionHash:
      sendResponse.hash,
  });

  return sendResponse.hash;
}

export async function readUnlockedCount({
  server,
  contractId,
  walletAddress,
}) {
  const value =
    await simulateContractCall({
      server,
      contractId,
      functionName:
        "get_unlocked_count",
      args: [
        addressToScVal(
          walletAddress
        ),
      ],
      source: walletAddress,
    });

  return normalizeContractValue(
    value
  );
}

export async function readPricePerChapter({
  server,
  contractId,
  walletAddress,
}) {
  const value =
    await simulateContractCall({
      server,
      contractId,
      functionName:
        "get_price_per_chapter",
      args: [],
      source: walletAddress,
    });

  return normalizeContractValue(
    value,
    "..."
  );
}

export async function readTokenBalance({
  server,
  contractId,
  walletAddress,
}) {
  const value =
    await simulateContractCall({
      server,
      contractId,
      functionName: "balance",
      args: [
        addressToScVal(
          walletAddress
        ),
      ],
      source: walletAddress,
    });

  return normalizeContractValue(
    value
  );
}

export async function claimDemoCoins({
  server,
  contractId,
  walletAddress,
  onSubmitted,
}) {
  return invokeSignedContract({
    server,
    contractId,
    functionName: "faucet",
    args: [
      addressToScVal(
        walletAddress
      ),
    ],
    walletAddress,
    onSubmitted,
  });
}

export async function unlockChapters({
  server,
  contractId,
  walletAddress,
  quantity,
  onSubmitted,
}) {
  return invokeSignedContract({
    server,
    contractId,
    functionName:
      "unlock_with_payment",
    args: [
      addressToScVal(
        walletAddress
      ),
      u32ToScVal(quantity),
    ],
    walletAddress,
    onSubmitted,
  });
}