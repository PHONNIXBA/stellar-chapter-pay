import {
  randomUUID,
} from "node:crypto";

import type {
  QueryResultRow,
} from "pg";

import {
  isDatabaseConfigured,
  queryDatabase,
} from "./databaseService";

import {
  getUserByWallet,
  isValidWalletAddress,
  markUserActivity,
  registerUser,
} from "./userService";

export type InteractionStatus =
  | "pending"
  | "success"
  | "failed";

export interface InteractionInput {
  walletAddress: string;
  action: string;
  status: InteractionStatus;
  txHash?: string;
  contractId?: string;
  contractFunction?: string;
  network?: string;
  metadata?: Record<string, unknown>;
}

export interface InteractionRecord {
  id: string;
  userId: string | null;
  walletAddress: string;
  action: string;
  status: InteractionStatus;
  txHash?: string;
  contractId?: string;
  contractFunction?: string;
  network: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface FeedbackInput {
  walletAddress: string;
  rating: number;
  comment: string;
  improvementCategory?: string;
}

export interface FeedbackRecord {
  id: string;
  userId: string | null;
  walletAddress: string;
  rating: number;
  comment: string;
  improvementCategory?: string;
  createdAt: string;
}

export interface AnalyticsSummary {
  totalInteractions: number;
  uniqueWallets: number;
  successfulTransactions: number;
  verifiedActiveWallets: number;

  interactionStatusCounts:
    Record<InteractionStatus, number>;

  actionCounts:
    Record<string, number>;

  totalFeedback: number;
  averageRating: number;

  latestInteraction:
    InteractionRecord | null;

  latestFeedback:
    FeedbackRecord | null;
}

interface InteractionRow
  extends QueryResultRow {
  id: string;
  user_id: string | null;
  wallet_address: string;
  action: string;
  status: InteractionStatus;
  tx_hash: string | null;
  contract_id: string | null;
  contract_function: string | null;
  network: string;
  metadata:
    Record<string, unknown> | null;
  created_at: Date | string;
}

interface FeedbackRow
  extends QueryResultRow {
  id: string;
  user_id: string | null;
  wallet_address: string;
  rating: number;
  comment: string;
  improvement_category: string | null;
  created_at: Date | string;
}

interface StatusCountRow
  extends QueryResultRow {
  status: InteractionStatus;
  count: number | string;
}

interface ActionCountRow
  extends QueryResultRow {
  action: string;
  count: number | string;
}

interface InteractionSummaryRow
  extends QueryResultRow {
  total_interactions:
    number | string;
  unique_wallets:
    number | string;
  successful_transactions:
    number | string;
  verified_active_wallets:
    number | string;
}

interface FeedbackSummaryRow
  extends QueryResultRow {
  total_feedback:
    number | string;
  average_rating:
    number | string | null;
}

const MAX_MEMORY_RECORDS = 500;

const ON_CHAIN_ACTIONS =
  new Set([
    "demo_coins_claimed",
    "chapters_unlocked",
  ]);

const interactions:
InteractionRecord[] = [];

const feedbackEntries:
FeedbackRecord[] = [];

function normalizeLimit(
  limit: number,
  maximum = 500
): number {
  if (
    !Number.isInteger(limit) ||
    limit <= 0
  ) {
    return 50;
  }

  return Math.min(
    limit,
    maximum
  );
}

function normalizeRequiredText(
  value: string,
  fieldName: string,
  maximumLength: number
): string {
  const normalizedValue =
    String(value || "").trim();

  if (!normalizedValue) {
    throw new Error(
      `${fieldName} is required.`
    );
  }

  if (
    normalizedValue.length >
    maximumLength
  ) {
    throw new Error(
      `${fieldName} is too long.`
    );
  }

  return normalizedValue;
}

function normalizeOptionalText(
  value: string | undefined,
  maximumLength: number
): string | undefined {
  if (
    typeof value !== "string"
  ) {
    return undefined;
  }

  const normalizedValue =
    value.trim();

  if (!normalizedValue) {
    return undefined;
  }

  if (
    normalizedValue.length >
    maximumLength
  ) {
    throw new Error(
      "Optional text value is too long."
    );
  }

  return normalizedValue;
}

function normalizeWalletAddress(
  walletAddress: string
): string {
  return normalizeRequiredText(
    walletAddress,
    "walletAddress",
    56
  ).toUpperCase();
}

function normalizeNetwork(
  network: string | undefined
): string {
  return (
    normalizeOptionalText(
      network,
      20
    ) || "TESTNET"
  ).toUpperCase();
}

function toIsoString(
  value: Date | string
): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return new Date(value)
    .toISOString();
}

function cloneMetadata(
  metadata:
    Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!metadata) {
    return undefined;
  }

  return {
    ...metadata,
  };
}

function cloneInteraction(
  interaction: InteractionRecord
): InteractionRecord {
  return {
    ...interaction,

    metadata:
      cloneMetadata(
        interaction.metadata
      ),
  };
}

function cloneFeedback(
  feedback: FeedbackRecord
): FeedbackRecord {
  return {
    ...feedback,
  };
}
export function isInteractionStatus(
  value: string
): value is InteractionStatus {
  return [
    "pending",
    "success",
    "failed",
  ].includes(value);
}

export function isValidContractId(
  value: string
): boolean {
  return /^C[A-Z2-7]{55}$/.test(
    String(value || "")
      .trim()
      .toUpperCase()
  );
}

export function isVerifiedOnChainInteraction(
  interaction:
    Pick<
      InteractionRecord,
      | "status"
      | "txHash"
      | "contractId"
    >
): boolean {
  return (
    interaction.status ===
      "success" &&
    Boolean(
      interaction.txHash
    ) &&
    Boolean(
      interaction.contractId
    )
  );
}

function mapInteractionRow(
  row: InteractionRow
): InteractionRecord {
  return {
    id: row.id,
    userId: row.user_id,

    walletAddress:
      row.wallet_address,

    action: row.action,
    status: row.status,

    txHash:
      row.tx_hash || undefined,

    contractId:
      row.contract_id || undefined,

    contractFunction:
      row.contract_function ||
      undefined,

    network: row.network,

    metadata:
      row.metadata || undefined,

    createdAt:
      toIsoString(
        row.created_at
      ),
  };
}

function mapFeedbackRow(
  row: FeedbackRow
): FeedbackRecord {
  return {
    id: row.id,
    userId: row.user_id,

    walletAddress:
      row.wallet_address,

    rating:
      Number(row.rating),

    comment:
      row.comment,

    improvementCategory:
      row.improvement_category ||
      undefined,

    createdAt:
      toIsoString(
        row.created_at
      ),
  };
}

async function ensureWalletUser(
  walletAddress: string
) {
  const existingUser =
    await getUserByWallet(
      walletAddress
    );

  if (existingUser) {
    return existingUser;
  }

  return registerUser({
    walletAddress,
  });
}

async function updateUserFromInteraction(
  interaction: InteractionRecord
): Promise<void> {
  if (
    isVerifiedOnChainInteraction(
      interaction
    )
  ) {
    await markUserActivity(
      interaction.walletAddress,
      "active"
    );

    return;
  }

  if (
    interaction.status ===
      "success" &&
    interaction.action ===
      "wallet_connected"
  ) {
    await markUserActivity(
      interaction.walletAddress,
      "wallet_connected"
    );
  }
}

async function findInteractionByTxHash(
  txHash: string
): Promise<InteractionRecord | null> {
  const normalizedHash =
    txHash.trim().toLowerCase();

  if (!isDatabaseConfigured()) {
    const interaction =
      interactions.find(
        (record) =>
          record.txHash
            ?.trim()
            .toLowerCase() ===
          normalizedHash
      );

    return interaction
      ? cloneInteraction(
          interaction
        )
      : null;
  }

  const result =
    await queryDatabase<InteractionRow>(
      `
        SELECT
          id,
          user_id,
          wallet_address,
          action,
          status,
          tx_hash,
          contract_id,
          contract_function,
          network,
          metadata,
          created_at
        FROM interactions
        WHERE
          tx_hash IS NOT NULL
          AND LOWER(tx_hash) =
            LOWER($1)
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [txHash]
    );

  if (
    result.rows.length === 0
  ) {
    return null;
  }

  return mapInteractionRow(
    result.rows[0]
  );
}

function transactionMatchesRequest(
  existing: InteractionRecord,
  input: {
    walletAddress: string;
    action: string;
    status: InteractionStatus;
    contractId?: string;
  }
): boolean {
  return (
    existing.walletAddress ===
      input.walletAddress &&
    existing.action ===
      input.action &&
    existing.status ===
      input.status &&
    (existing.contractId || "") ===
      (input.contractId || "")
  );
}

async function validateTransactionOwnership(
  input: {
    walletAddress: string;
    action: string;
    status: InteractionStatus;
    txHash?: string;
    contractId?: string;
  }
): Promise<InteractionRecord | null> {
  if (!input.txHash) {
    return null;
  }

  const existing =
    await findInteractionByTxHash(
      input.txHash
    );

  if (!existing) {
    return null;
  }

  if (
    transactionMatchesRequest(
      existing,
      input
    )
  ) {
    return existing;
  }

  if (
    existing.walletAddress !==
    input.walletAddress
  ) {
    throw new Error(
      "Transaction hash is already associated with another wallet."
    );
  }

  throw new Error(
    "Transaction hash is already associated with another interaction."
  );
}
export async function createInteraction(
  input: InteractionInput
): Promise<InteractionRecord> {
  const walletAddress =
    normalizeWalletAddress(
      input.walletAddress
    );

  if (
    !isValidWalletAddress(
      walletAddress
    )
  ) {
    throw new Error(
      "A valid Stellar wallet address is required."
    );
  }

  if (
    !isInteractionStatus(
      input.status
    )
  ) {
    throw new Error(
      "A valid interaction status is required."
    );
  }

  const action =
    normalizeRequiredText(
      input.action,
      "action",
      80
    );

  const txHash =
    normalizeOptionalText(
      input.txHash,
      128
    );

  const rawContractId =
    normalizeOptionalText(
      input.contractId,
      56
    );

  const contractId =
    rawContractId
      ? rawContractId.toUpperCase()
      : undefined;

  if (
    contractId &&
    !isValidContractId(
      contractId
    )
  ) {
    throw new Error(
      "A valid Stellar contract ID is required."
    );
  }

  const contractFunction =
    normalizeOptionalText(
      input.contractFunction,
      80
    );

  const network =
    normalizeNetwork(
      input.network
    );

  const metadata =
    cloneMetadata(
      input.metadata
    );

  const isSuccessfulOnChainAction =
    input.status === "success" &&
    ON_CHAIN_ACTIONS.has(action);

  if (
    isSuccessfulOnChainAction &&
    !txHash
  ) {
    throw new Error(
      "A transaction hash is required for a successful on-chain action."
    );
  }

  if (
    isSuccessfulOnChainAction &&
    !contractId
  ) {
    throw new Error(
      "A contract ID is required for a successful on-chain action."
    );
  }

  if (
    txHash &&
    !contractId
  ) {
    throw new Error(
      "A contract ID is required when a transaction hash is provided."
    );
  }

  const existingInteraction =
    await validateTransactionOwnership({
      walletAddress,
      action,
      status:
        input.status,
      txHash,
      contractId,
    });

  if (existingInteraction) {
    return existingInteraction;
  }

  const user =
    await ensureWalletUser(
      walletAddress
    );

  if (!isDatabaseConfigured()) {
    const interaction:
    InteractionRecord = {
      id: randomUUID(),
      userId: user.id,
      walletAddress,
      action,
      status:
        input.status,
      txHash,
      contractId,
      contractFunction,
      network,
      metadata,

      createdAt:
        new Date().toISOString(),
    };

    interactions.unshift(
      interaction
    );

    if (
      interactions.length >
      MAX_MEMORY_RECORDS
    ) {
      interactions.length =
        MAX_MEMORY_RECORDS;
    }

    await updateUserFromInteraction(
      interaction
    );

    return cloneInteraction(
      interaction
    );
  }

  const result =
    await queryDatabase<InteractionRow>(
      `
        INSERT INTO interactions (
          id,
          user_id,
          wallet_address,
          action,
          contract_id,
          contract_function,
          status,
          tx_hash,
          network,
          metadata
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10::JSONB
        )
        RETURNING
          id,
          user_id,
          wallet_address,
          action,
          status,
          tx_hash,
          contract_id,
          contract_function,
          network,
          metadata,
          created_at
      `,
      [
        randomUUID(),
        user.id,
        walletAddress,
        action,
        contractId || null,
        contractFunction || null,
        input.status,
        txHash || null,
        network,

        JSON.stringify(
          metadata || {}
        ),
      ]
    );

  const interaction =
    mapInteractionRow(
      result.rows[0]
    );

  await updateUserFromInteraction(
    interaction
  );

  return interaction;
}

export async function listInteractions(
  limit = 50
): Promise<InteractionRecord[]> {
  const safeLimit =
    normalizeLimit(limit);

  if (!isDatabaseConfigured()) {
    return interactions
      .slice(0, safeLimit)
      .map(cloneInteraction);
  }

  const result =
    await queryDatabase<InteractionRow>(
      `
        SELECT
          id,
          user_id,
          wallet_address,
          action,
          status,
          tx_hash,
          contract_id,
          contract_function,
          network,
          metadata,
          created_at
        FROM interactions
        ORDER BY created_at DESC
        LIMIT $1
      `,
      [safeLimit]
    );

  return result.rows.map(
    mapInteractionRow
  );
}

export async function createFeedback(
  input: FeedbackInput
): Promise<FeedbackRecord> {
  const walletAddress =
    normalizeWalletAddress(
      input.walletAddress
    );

  if (
    !isValidWalletAddress(
      walletAddress
    )
  ) {
    throw new Error(
      "A valid Stellar wallet address is required."
    );
  }

  if (
    !Number.isInteger(
      input.rating
    ) ||
    input.rating < 1 ||
    input.rating > 5
  ) {
    throw new Error(
      "rating must be an integer from 1 to 5."
    );
  }

  const comment =
    normalizeRequiredText(
      input.comment,
      "comment",
      2000
    );

  const improvementCategory =
    normalizeOptionalText(
      input.improvementCategory,
      80
    );

  const user =
    await ensureWalletUser(
      walletAddress
    );

  if (!isDatabaseConfigured()) {
    const feedback:
    FeedbackRecord = {
      id: randomUUID(),
      userId: user.id,
      walletAddress,
      rating: input.rating,
      comment,
      improvementCategory,

      createdAt:
        new Date().toISOString(),
    };

    feedbackEntries.unshift(
      feedback
    );

    if (
      feedbackEntries.length >
      MAX_MEMORY_RECORDS
    ) {
      feedbackEntries.length =
        MAX_MEMORY_RECORDS;
    }

    return cloneFeedback(
      feedback
    );
  }

  const result =
    await queryDatabase<FeedbackRow>(
      `
        INSERT INTO feedback (
          id,
          user_id,
          wallet_address,
          rating,
          comment,
          improvement_category
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6
        )
        RETURNING
          id,
          user_id,
          wallet_address,
          rating,
          comment,
          improvement_category,
          created_at
      `,
      [
        randomUUID(),
        user.id,
        walletAddress,
        input.rating,
        comment,

        improvementCategory ||
        null,
      ]
    );

  return mapFeedbackRow(
    result.rows[0]
  );
}

export async function listFeedback(
  limit = 50
): Promise<FeedbackRecord[]> {
  const safeLimit =
    normalizeLimit(limit);

  if (!isDatabaseConfigured()) {
    return feedbackEntries
      .slice(0, safeLimit)
      .map(cloneFeedback);
  }

  const result =
    await queryDatabase<FeedbackRow>(
      `
        SELECT
          id,
          user_id,
          wallet_address,
          rating,
          comment,
          improvement_category,
          created_at
        FROM feedback
        ORDER BY created_at DESC
        LIMIT $1
      `,
      [safeLimit]
    );

  return result.rows.map(
    mapFeedbackRow
  );
}
export async function getAnalyticsSummary():
Promise<AnalyticsSummary> {
  if (!isDatabaseConfigured()) {
    const interactionStatusCounts:
    Record<InteractionStatus, number> = {
      pending: 0,
      success: 0,
      failed: 0,
    };

    const actionCounts:
    Record<string, number> = {};

    const uniqueWallets =
      new Set<string>();

    const verifiedWallets =
      new Set<string>();

    let successfulTransactions = 0;

    for (
      const interaction of interactions
    ) {
      interactionStatusCounts[
        interaction.status
      ] += 1;

      actionCounts[
        interaction.action
      ] =
        (
          actionCounts[
            interaction.action
          ] || 0
        ) + 1;

      uniqueWallets.add(
        interaction.walletAddress
      );

      if (
        isVerifiedOnChainInteraction(
          interaction
        )
      ) {
        successfulTransactions += 1;

        verifiedWallets.add(
          interaction.walletAddress
        );
      }
    }

    const averageRating =
      feedbackEntries.length > 0
        ? feedbackEntries.reduce(
            (
              total,
              feedback
            ) =>
              total +
              feedback.rating,
            0
          ) /
          feedbackEntries.length
        : 0;

    return {
      totalInteractions:
        interactions.length,

      uniqueWallets:
        uniqueWallets.size,

      successfulTransactions,

      verifiedActiveWallets:
        verifiedWallets.size,

      interactionStatusCounts,
      actionCounts,

      totalFeedback:
        feedbackEntries.length,

      averageRating:
        Number(
          averageRating.toFixed(2)
        ),

      latestInteraction:
        interactions[0]
          ? cloneInteraction(
              interactions[0]
            )
          : null,

      latestFeedback:
        feedbackEntries[0]
          ? cloneFeedback(
              feedbackEntries[0]
            )
          : null,
    };
  }

  const [
    interactionSummaryResult,
    statusResult,
    actionResult,
    feedbackSummaryResult,
    latestInteractions,
    latestFeedbackEntries,
  ] = await Promise.all([
    queryDatabase<
      InteractionSummaryRow
    >(
      `
        SELECT
          COUNT(*)::INT
            AS total_interactions,

          COUNT(
            DISTINCT wallet_address
          )::INT
            AS unique_wallets,

          COUNT(*) FILTER (
            WHERE
              status = 'success'
              AND tx_hash IS NOT NULL
              AND contract_id IS NOT NULL
          )::INT
            AS successful_transactions,

          COUNT(
            DISTINCT wallet_address
          ) FILTER (
            WHERE
              status = 'success'
              AND tx_hash IS NOT NULL
              AND contract_id IS NOT NULL
          )::INT
            AS verified_active_wallets
        FROM interactions
      `
    ),

    queryDatabase<
      StatusCountRow
    >(
      `
        SELECT
          status,
          COUNT(*)::INT AS count
        FROM interactions
        GROUP BY status
      `
    ),

    queryDatabase<
      ActionCountRow
    >(
      `
        SELECT
          action,
          COUNT(*)::INT AS count
        FROM interactions
        GROUP BY action
      `
    ),

    queryDatabase<
      FeedbackSummaryRow
    >(
      `
        SELECT
          COUNT(*)::INT
            AS total_feedback,

          COALESCE(
            AVG(rating),
            0
          )
            AS average_rating
        FROM feedback
      `
    ),

    listInteractions(1),
    listFeedback(1),
  ]);

  const summary =
    interactionSummaryResult
      .rows[0];

  const feedbackSummary =
    feedbackSummaryResult
      .rows[0];

  const interactionStatusCounts:
  Record<InteractionStatus, number> = {
    pending: 0,
    success: 0,
    failed: 0,
  };

  for (
    const row of statusResult.rows
  ) {
    interactionStatusCounts[
      row.status
    ] = Number(row.count);
  }

  const actionCounts:
  Record<string, number> = {};

  for (
    const row of actionResult.rows
  ) {
    actionCounts[row.action] =
      Number(row.count);
  }

  return {
    totalInteractions:
      Number(
        summary
          ?.total_interactions || 0
      ),

    uniqueWallets:
      Number(
        summary
          ?.unique_wallets || 0
      ),

    successfulTransactions:
      Number(
        summary
          ?.successful_transactions ||
        0
      ),

    verifiedActiveWallets:
      Number(
        summary
          ?.verified_active_wallets ||
        0
      ),

    interactionStatusCounts,
    actionCounts,

    totalFeedback:
      Number(
        feedbackSummary
          ?.total_feedback || 0
      ),

    averageRating:
      Number(
        Number(
          feedbackSummary
            ?.average_rating || 0
        ).toFixed(2)
      ),

    latestInteraction:
      latestInteractions[0] ||
      null,

    latestFeedback:
      latestFeedbackEntries[0] ||
      null,
  };
}

export function clearDataForTests():
void {
  interactions.length = 0;
  feedbackEntries.length = 0;
}
