import {
  getRuntimeConfig,
  type RuntimeConfig,
} from "./contractService";

import {
  listFeedback,
  listInteractions,
  type FeedbackRecord,
  type InteractionRecord,
} from "./dataService";

import {
  listUsers,
  type UserRecord,
} from "./userService";

const EVIDENCE_RECORD_LIMIT = 500;

export type PublicEvidenceVerification =
  | "Verified"
  | "Pending";

export interface PublicEvidenceRow {
  walletAddress: string;
  action: string;
  contractId: string;
  contractFunction: string;
  transactionHash: string;
  chaptersUnlocked: number;
  amount: number;
  rating: number | null;
  feedback: string;
  verification:
    PublicEvidenceVerification;
  network: string;
}

export interface PublicEvidenceSummary {
  totalWallets: number;
  verifiedWallets: number;
  verifiedTransactions: number;
  totalChapters: number;
  totalAmount: number;
  averageRating: number;
}

export interface PublicEvidenceResult {
  count: number;
  summary: PublicEvidenceSummary;
  records: PublicEvidenceRow[];
}

interface ResolvedInteraction {
  interaction: InteractionRecord;
  contractId: string;
}

function normalizeWalletKey(
  walletAddress: string
): string {
  return String(walletAddress || "")
    .trim()
    .toUpperCase();
}

function normalizeHashKey(
  transactionHash: string
): string {
  return String(transactionHash || "")
    .trim()
    .toLowerCase();
}

function normalizeContractId(
  contractId: string | undefined
): string {
  return String(contractId || "")
    .trim()
    .toUpperCase();
}

function normalizeActionValue(
  value: string | undefined
): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function toTimestamp(
  value: string
): number {
  const timestamp =
    Date.parse(value);

  return Number.isFinite(timestamp)
    ? timestamp
    : 0;
}

function sortNewestFirst(
  first: InteractionRecord,
  second: InteractionRecord
): number {
  return (
    toTimestamp(second.createdAt) -
    toTimestamp(first.createdAt)
  );
}

function readNumber(
  metadata:
    Record<string, unknown> | undefined,
  keys: readonly string[]
): number {
  if (!metadata) {
    return 0;
  }

  for (const key of keys) {
    const value = metadata[key];

    if (
      typeof value === "number" &&
      Number.isFinite(value)
    ) {
      return Math.max(0, value);
    }

    if (
      typeof value === "string" &&
      value.trim()
    ) {
      const parsedValue =
        Number(value);

      if (
        Number.isFinite(parsedValue)
      ) {
        return Math.max(
          0,
          parsedValue
        );
      }
    }
  }

  return 0;
}

function getChaptersUnlocked(
  interaction: InteractionRecord
): number {
  return readNumber(
    interaction.metadata,
    [
      "quantity",
      "chaptersUnlocked",
      "chapters",
      "chapterCount",
    ]
  );
}

function getTransactionAmount(
  interaction: InteractionRecord
): number {
  return readNumber(
    interaction.metadata,
    [
      "totalPrice",
      "amount",
      "paymentAmount",
      "totalAmount",
    ]
  );
}

export function resolveEvidenceContractId(
  interaction:
    Pick<
      InteractionRecord,
      | "action"
      | "contractId"
      | "contractFunction"
    >,
  runtimeConfig:
    RuntimeConfig =
      getRuntimeConfig()
): string {
  const explicitContractId =
    normalizeContractId(
      interaction.contractId
    );

  if (explicitContractId) {
    return explicitContractId;
  }

  const action =
    normalizeActionValue(
      interaction.action
    );

  const contractFunction =
    normalizeActionValue(
      interaction.contractFunction
    );

  const tokenActions =
    new Set([
      "demo_coins_claimed",
      "demo_tokens_claimed",
      "token_faucet",
    ]);

  if (
    tokenActions.has(action) ||
    contractFunction === "faucet"
  ) {
    return normalizeContractId(
      runtimeConfig
        .chapterTokenContractId
    );
  }

  const paymentActions =
    new Set([
      "chapters_unlocked",
      "chapter_unlocked",
      "chapter_purchased",
    ]);

  if (
    paymentActions.has(action) ||
    contractFunction ===
      "unlock_with_payment"
  ) {
    return normalizeContractId(
      runtimeConfig
        .chapterPaymentContractId
    );
  }

  return "";
}

function buildLatestFeedbackMap(
  feedbackEntries:
    readonly FeedbackRecord[]
): Map<string, FeedbackRecord> {
  const latestFeedbackByWallet =
    new Map<
      string,
      FeedbackRecord
    >();

  for (
    const feedback of
    feedbackEntries
  ) {
    const walletKey =
      normalizeWalletKey(
        feedback.walletAddress
      );

    if (!walletKey) {
      continue;
    }

    const current =
      latestFeedbackByWallet.get(
        walletKey
      );

    if (
      !current ||
      toTimestamp(
        feedback.createdAt
      ) >
        toTimestamp(
          current.createdAt
        )
    ) {
      latestFeedbackByWallet.set(
        walletKey,
        feedback
      );
    }
  }

  return latestFeedbackByWallet;
}

function buildWalletOrder(
  users: readonly UserRecord[],
  verifiedInteractions:
    readonly ResolvedInteraction[]
): string[] {
  const walletOrder: string[] = [];
  const knownWallets =
    new Set<string>();

  for (const user of users) {
    const walletKey =
      normalizeWalletKey(
        user.walletAddress
      );

    if (
      walletKey &&
      !knownWallets.has(
        walletKey
      )
    ) {
      knownWallets.add(
        walletKey
      );

      walletOrder.push(
        walletKey
      );
    }
  }

  for (
    const {
      interaction,
    } of verifiedInteractions
  ) {
    const walletKey =
      normalizeWalletKey(
        interaction.walletAddress
      );

    if (
      walletKey &&
      !knownWallets.has(
        walletKey
      )
    ) {
      knownWallets.add(
        walletKey
      );

      walletOrder.push(
        walletKey
      );
    }
  }

  return walletOrder;
}

function collectVerifiedInteractions(
  interactions:
    readonly InteractionRecord[],
  runtimeConfig: RuntimeConfig
): ResolvedInteraction[] {
  const sortedInteractions =
    [...interactions].sort(
      sortNewestFirst
    );

  const exactInteractionKeys =
    new Set<string>();

  const candidateInteractions:
  ResolvedInteraction[] = [];

  for (
    const interaction of
    sortedInteractions
  ) {
    if (
      interaction.status !==
      "success"
    ) {
      continue;
    }

    const transactionHash =
      normalizeHashKey(
        interaction.txHash || ""
      );

    if (!transactionHash) {
      continue;
    }

    const walletAddress =
      normalizeWalletKey(
        interaction.walletAddress
      );

    if (!walletAddress) {
      continue;
    }

    const contractId =
      resolveEvidenceContractId(
        interaction,
        runtimeConfig
      );

    if (!contractId) {
      continue;
    }

    const exactKey = [
      walletAddress,
      contractId,
      transactionHash,
    ].join(":");

    if (
      exactInteractionKeys.has(
        exactKey
      )
    ) {
      continue;
    }

    exactInteractionKeys.add(
      exactKey
    );

    candidateInteractions.push({
      interaction,
      contractId,
    });
  }

  const walletsByHash =
    new Map<
      string,
      Set<string>
    >();

  for (
    const {
      interaction,
    } of candidateInteractions
  ) {
    const transactionHash =
      normalizeHashKey(
        interaction.txHash || ""
      );

    const walletAddress =
      normalizeWalletKey(
        interaction.walletAddress
      );

    const wallets =
      walletsByHash.get(
        transactionHash
      ) || new Set<string>();

    wallets.add(walletAddress);

    walletsByHash.set(
      transactionHash,
      wallets
    );
  }

  return candidateInteractions.filter(
    ({ interaction }) => {
      const transactionHash =
        normalizeHashKey(
          interaction.txHash || ""
        );

      const owners =
        walletsByHash.get(
          transactionHash
        );

      return owners?.size === 1;
    }
  );
}

function buildInteractionMap(
  verifiedInteractions:
    readonly ResolvedInteraction[]
): Map<
  string,
  ResolvedInteraction[]
> {
  const interactionsByWallet =
    new Map<
      string,
      ResolvedInteraction[]
    >();

  for (
    const resolvedInteraction of
    verifiedInteractions
  ) {
    const walletKey =
      normalizeWalletKey(
        resolvedInteraction
          .interaction
          .walletAddress
      );

    const walletInteractions =
      interactionsByWallet.get(
        walletKey
      ) || [];

    walletInteractions.push(
      resolvedInteraction
    );

    interactionsByWallet.set(
      walletKey,
      walletInteractions
    );
  }

  for (
    const walletInteractions of
    interactionsByWallet.values()
  ) {
    walletInteractions.sort(
      (
        first,
        second
      ) =>
        sortNewestFirst(
          first.interaction,
          second.interaction
        )
    );
  }

  return interactionsByWallet;
}

function buildVerifiedRow(
  resolvedInteraction:
    ResolvedInteraction,
  latestFeedback:
    FeedbackRecord | undefined,
  defaultNetwork: string
): PublicEvidenceRow {
  const interaction =
    resolvedInteraction.interaction;

  return {
    walletAddress:
      normalizeWalletKey(
        interaction.walletAddress
      ),

    action:
      interaction.action,

    contractId:
      resolvedInteraction.contractId,

    contractFunction:
      interaction
        .contractFunction || "",

    transactionHash:
      interaction.txHash || "",

    chaptersUnlocked:
      getChaptersUnlocked(
        interaction
      ),

    amount:
      getTransactionAmount(
        interaction
      ),

    rating:
      latestFeedback?.rating ??
      null,

    feedback:
      latestFeedback?.comment ||
      "",

    verification:
      "Verified",

    network:
      interaction.network ||
      defaultNetwork,
  };
}

function buildPendingRow(
  walletAddress: string,
  latestFeedback:
    FeedbackRecord | undefined,
  defaultNetwork: string
): PublicEvidenceRow {
  return {
    walletAddress,
    action: "",
    contractId: "",
    contractFunction: "",
    transactionHash: "",
    chaptersUnlocked: 0,
    amount: 0,

    rating:
      latestFeedback?.rating ??
      null,

    feedback:
      latestFeedback?.comment ||
      "",

    verification:
      "Pending",

    network:
      defaultNetwork,
  };
}

function calculateAverageRating(
  walletOrder:
    readonly string[],
  latestFeedbackByWallet:
    ReadonlyMap<
      string,
      FeedbackRecord
    >
): number {
  const ratings: number[] = [];

  for (
    const walletAddress of
    walletOrder
  ) {
    const rating =
      latestFeedbackByWallet.get(
        walletAddress
      )?.rating;

    if (
      typeof rating === "number"
    ) {
      ratings.push(rating);
    }
  }

  if (ratings.length === 0) {
    return 0;
  }

  const total =
    ratings.reduce(
      (
        sum,
        rating
      ) => sum + rating,
      0
    );

  return Number(
    (
      total /
      ratings.length
    ).toFixed(2)
  );
}

export async function buildPublicEvidence():
Promise<PublicEvidenceResult> {
  const runtimeConfig =
    getRuntimeConfig();

  const [
    users,
    interactions,
    feedbackEntries,
  ] = await Promise.all([
    listUsers(
      EVIDENCE_RECORD_LIMIT
    ),

    listInteractions(
      EVIDENCE_RECORD_LIMIT
    ),

    listFeedback(
      EVIDENCE_RECORD_LIMIT
    ),
  ]);

  const verifiedInteractions =
    collectVerifiedInteractions(
      interactions,
      runtimeConfig
    );

  const latestFeedbackByWallet =
    buildLatestFeedbackMap(
      feedbackEntries
    );

  const walletOrder =
    buildWalletOrder(
      users,
      verifiedInteractions
    );

  const interactionsByWallet =
    buildInteractionMap(
      verifiedInteractions
    );

  const records:
  PublicEvidenceRow[] = [];

  for (
    const walletAddress of
    walletOrder
  ) {
    const walletInteractions =
      interactionsByWallet.get(
        walletAddress
      ) || [];

    const latestFeedback =
      latestFeedbackByWallet.get(
        walletAddress
      );

    if (
      walletInteractions.length === 0
    ) {
      records.push(
        buildPendingRow(
          walletAddress,
          latestFeedback,
          runtimeConfig.network
        )
      );

      continue;
    }

    for (
      const resolvedInteraction of
      walletInteractions
    ) {
      records.push(
        buildVerifiedRow(
          resolvedInteraction,
          latestFeedback,
          runtimeConfig.network
        )
      );
    }
  }

  const verifiedWallets =
    new Set(
      verifiedInteractions.map(
        ({
          interaction,
        }) =>
          normalizeWalletKey(
            interaction
              .walletAddress
          )
      )
    );

  const totalChapters =
    verifiedInteractions.reduce(
      (
        total,
        {
          interaction,
        }
      ) =>
        total +
        getChaptersUnlocked(
          interaction
        ),
      0
    );

  const totalAmount =
    verifiedInteractions.reduce(
      (
        total,
        {
          interaction,
        }
      ) =>
        total +
        getTransactionAmount(
          interaction
        ),
      0
    );

  return {
    count:
      records.length,

    summary: {
      totalWallets:
        walletOrder.length,

      verifiedWallets:
        verifiedWallets.size,

      verifiedTransactions:
        verifiedInteractions.length,

      totalChapters,
      totalAmount,

      averageRating:
        calculateAverageRating(
          walletOrder,
          latestFeedbackByWallet
        ),
    },

    records,
  };
}
