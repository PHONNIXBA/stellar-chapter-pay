import { Networks } from "@stellar/stellar-sdk";

export const STELLAR_NETWORK = Object.freeze({
  name: "TESTNET",
  rpcUrl:
    "https://soroban-testnet.stellar.org:443",
  networkPassphrase: Networks.TESTNET,
  explorerBaseUrl:
    "https://stellar.expert/explorer/testnet",
});

export const CONTRACT_CONFIG_URL =
  "/contracts.json";

function normalizeContractId(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

export function hasCompleteContractConfig(config) {
  return Boolean(
    config?.chapterContractId &&
    config?.tokenContractId
  );
}

export async function loadContractConfig(
  fetchImplementation = globalThis.fetch
) {
  if (
    typeof fetchImplementation !== "function"
  ) {
    throw new Error(
      "A fetch implementation is required."
    );
  }

  const response = await fetchImplementation(
    CONTRACT_CONFIG_URL
  );

  if (!response.ok) {
    throw new Error(
      `Contract config request failed with status ${response.status}.`
    );
  }

  const data = await response.json();

  const config = {
    chapterContractId: normalizeContractId(
      data.chapter_contract_id
    ),
    tokenContractId: normalizeContractId(
      data.token_contract_id
    ),
  };

  if (!hasCompleteContractConfig(config)) {
    throw new Error(
      "Contract configuration is incomplete."
    );
  }

  return config;
}

export function createTransactionExplorerUrl(
  transactionHash
) {
  if (!transactionHash) {
    return "";
  }

  return (
    `${STELLAR_NETWORK.explorerBaseUrl}` +
    `/tx/${transactionHash}`
  );
}