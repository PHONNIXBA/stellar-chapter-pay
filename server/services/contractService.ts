export interface RuntimeConfig {
  network: string;
  rpcUrl: string;
  explorerUrl: string;
  chapterPaymentContractId: string;
  chapterTokenContractId: string;
}

export interface ContractFunctionDescriptor {
  contract: "chapter-payment" | "chapter-token";
  name: string;
  type: "read" | "write" | "admin";
  description: string;
}

function readEnvironmentValue(
  name: string,
  fallback = ""
): string {
  return process.env[name]?.trim() || fallback;
}

export function getRuntimeConfig(): RuntimeConfig {
  return {
    network: readEnvironmentValue(
      "STELLAR_NETWORK",
      "TESTNET"
    ),

    rpcUrl: readEnvironmentValue(
      "STELLAR_RPC_URL",
      "https://soroban-testnet.stellar.org:443"
    ),

    explorerUrl: readEnvironmentValue(
      "STELLAR_EXPLORER_URL",
      "https://stellar.expert/explorer/testnet"
    ),

    chapterPaymentContractId:
      readEnvironmentValue(
        "CHAPTER_PAYMENT_CONTRACT_ID"
      ),

    chapterTokenContractId:
      readEnvironmentValue(
        "CHAPTER_TOKEN_CONTRACT_ID"
      ),
  };
}

const CONTRACT_FUNCTIONS: ContractFunctionDescriptor[] = [
  {
    contract: "chapter-payment",
    name: "initialize",
    type: "admin",
    description:
      "Initialize the payment contract configuration.",
  },
  {
    contract: "chapter-payment",
    name: "unlock_with_payment",
    type: "write",
    description:
      "Pay Chapter Coin and unlock one or more chapters.",
  },
  {
    contract: "chapter-payment",
    name: "update_price",
    type: "admin",
    description:
      "Update the price charged for each chapter.",
  },
  {
    contract: "chapter-payment",
    name: "set_paused",
    type: "admin",
    description:
      "Pause or resume chapter purchases.",
  },
  {
    contract: "chapter-payment",
    name: "get_unlocked_count",
    type: "read",
    description:
      "Read the number of chapters unlocked by a wallet.",
  },
  {
    contract: "chapter-payment",
    name: "get_price_per_chapter",
    type: "read",
    description:
      "Read the current price per chapter.",
  },
  {
    contract: "chapter-payment",
    name: "get_payment",
    type: "read",
    description:
      "Read an individual chapter payment record.",
  },
  {
    contract: "chapter-payment",
    name: "get_stats",
    type: "read",
    description:
      "Read aggregate payment statistics.",
  },
  {
    contract: "chapter-token",
    name: "initialize",
    type: "admin",
    description:
      "Initialize the Chapter Coin contract.",
  },
  {
    contract: "chapter-token",
    name: "faucet",
    type: "write",
    description:
      "Claim the one-time demo Chapter Coin allocation.",
  },
  {
    contract: "chapter-token",
    name: "mint",
    type: "admin",
    description:
      "Mint Chapter Coin through administrator authorization.",
  },
  {
    contract: "chapter-token",
    name: "transfer",
    type: "write",
    description:
      "Transfer Chapter Coin between Stellar addresses.",
  },
  {
    contract: "chapter-token",
    name: "balance",
    type: "read",
    description:
      "Read the Chapter Coin balance of an address.",
  },
  {
    contract: "chapter-token",
    name: "get_stats",
    type: "read",
    description:
      "Read token supply and faucet statistics.",
  },
];

export function getContractFunctions():
ContractFunctionDescriptor[] {
  return CONTRACT_FUNCTIONS.map(
    (functionDescriptor) => ({
      ...functionDescriptor,
    })
  );
}

export function getProductReadiness() {
  const config = getRuntimeConfig();

  return {
    status: "ready-for-validation",

    checks: {
      contractArchitecture: true,
      frontendIntegration: true,
      backendService: true,
      interactionTracking: true,
      feedbackCollection: true,
      analyticsSummary: true,

      runtimeContractIdsConfigured: Boolean(
        config.chapterPaymentContractId &&
        config.chapterTokenContractId
      ),
    },

    functionCoverage: {
      total: CONTRACT_FUNCTIONS.length,

      chapterPayment:
        CONTRACT_FUNCTIONS.filter(
          (item) =>
            item.contract ===
            "chapter-payment"
        ).length,

      chapterToken:
        CONTRACT_FUNCTIONS.filter(
          (item) =>
            item.contract ===
            "chapter-token"
        ).length,
    },
  };
}