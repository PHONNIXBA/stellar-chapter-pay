import { randomUUID } from "node:crypto";

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
  contractFunction?: string;
  network: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface FeedbackInput {
  walletAddress?: string;
  rating: number;
  comment: string;
  improvementCategory?: string;
}

export interface FeedbackRecord {
  id: string;
  userId: string | null;
  walletAddress?: string;
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
  contract_function:
    string | null;
  network: string;
  metadata:
    Record<string, unknown> | null;
  created_at: Date | string;
}

interface FeedbackRow
  extends QueryResultRow {
  id: string;
  user_id: string | null;
  wallet_address: string | null;
  rating: number;
  comment: string;
  improvement_category:
    string | null;
  created_at: Date | string;
}

interface StatusCountRow
  extends QueryResultRow {
  status: InteractionStatus;
  count: number;
}

interface ActionCountRow
  extends QueryResultRow {
  action: string;
  count: number;
}

interface InteractionSummaryRow
  extends QueryResultRow {
  total_interactions: number;
  unique_wallets: number;
  successful_transactions: number;
  verified_active_wallets: number;
}

interface FeedbackSummaryRow
  extends QueryResultRow {
  total_feedback: number;
  average_rating:
    number | string | null;
}

const MAX_MEMORY_RECORDS = 500;

const interactions:
InteractionRecord[] = [];

const feedbackEntries:
FeedbackRecord[] = [];

function normalizeLimit(
  limit: number,
  maximum = 200
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
    value.trim();

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
  if (!value) {
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
    128
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

    contractFunction:
      row.contract_function ||
      undefined,

    network: row.network,

    metadata:
      row.metadata || undefined,

    createdAt:
      toIsoString(row.created_at),
  };
}

function mapFeedbackRow(
  row: FeedbackRow
): FeedbackRecord {
  return {
    id: row.id,
    userId: row.user_id,

    walletAddress:
      row.wallet_address ||
      undefined,

    rating: Number(row.rating),
    comment: row.comment,

    improvementCategory:
      row.improvement_category ||
      undefined,

    createdAt:
      toIsoString(row.created_at),
  };
}

async function updateUserFromInteraction(
  interaction: InteractionRecord
): Promise<void> {
  if (
    !isValidWalletAddress(
      interaction.walletAddress
    )
  ) {
    return;
  }

  if (
    interaction.status ===
      "success" &&
    interaction.txHash
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

export async function createInteraction(
  input: InteractionInput
): Promise<InteractionRecord> {
  const walletAddress =
    normalizeWalletAddress(
      input.walletAddress
    );

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
    cloneMetadata(input.metadata);

  if (!isDatabaseConfigured()) {
    const user =
      isValidWalletAddress(
        walletAddress
      )
        ? await getUserByWallet(
            walletAddress
          )
        : null;

    const interaction:
    InteractionRecord = {
      id: randomUUID(),
      userId: user?.id || null,
      walletAddress,
      action,
      status: input.status,
      txHash,
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
          contract_function,
          status,
          tx_hash,
          network,
          metadata
        )
        VALUES (
          $1,
          (
            SELECT id
            FROM users
            WHERE wallet_address = $2
            LIMIT 1
          ),
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8::JSONB
        )
        RETURNING
          id,
          user_id,
          wallet_address,
          action,
          status,
          tx_hash,
          contract_function,
          network,
          metadata,
          created_at
      `,
      [
        randomUUID(),
        walletAddress,
        action,
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
    input.walletAddress
      ? normalizeWalletAddress(
          input.walletAddress
        )
      : undefined;

  const comment =
    normalizeRequiredText(
      input.comment,
      "comment",
      2000
    );

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

  const improvementCategory =
    normalizeOptionalText(
      input.improvementCategory,
      80
    );

  if (!isDatabaseConfigured()) {
    const user =
      walletAddress &&
      isValidWalletAddress(
        walletAddress
      )
        ? await getUserByWallet(
            walletAddress
          )
        : null;

    const feedback:
    FeedbackRecord = {
      id: randomUUID(),
      userId: user?.id || null,
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
          (
            SELECT id
            FROM users
            WHERE wallet_address = $2
            LIMIT 1
          ),
          $2,
          $3,
          $4,
          $5
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
        walletAddress || null,
        input.rating,
        comment,
        improvementCategory || null,
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

function getMemoryAnalytics():
AnalyticsSummary {
  const interactionStatusCounts:
  Record<InteractionStatus, number> = {
    pending: 0,
    success: 0,
    failed: 0,
  };

  const actionCounts:
  Record<string, number> = {};

  for (
    const interaction of
    interactions
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
  }

  const successfulTransactions =
    interactions.filter(
      (interaction) =>
        interaction.status ===
          "success" &&
        Boolean(
          interaction.txHash
        )
    ).length;

  const uniqueWallets =
    new Set(
      interactions.map(
        (interaction) =>
          interaction.walletAddress
      )
    ).size;

  const verifiedActiveWallets =
    new Set(
      interactions
        .filter(
          (interaction) =>
            interaction.status ===
              "success" &&
            Boolean(
              interaction.txHash
            )
        )
        .map(
          (interaction) =>
            interaction.walletAddress
        )
    ).size;

  const averageRating =
    feedbackEntries.length === 0
      ? 0
      : Number(
          (
            feedbackEntries.reduce(
              (total, feedback) =>
                total +
                feedback.rating,
              0
            ) /
            feedbackEntries.length
          ).toFixed(2)
        );

  return {
    totalInteractions:
      interactions.length,

    uniqueWallets,
    successfulTransactions,
    verifiedActiveWallets,
    interactionStatusCounts,
    actionCounts,

    totalFeedback:
      feedbackEntries.length,

    averageRating,

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

export async function getAnalyticsSummary():
Promise<AnalyticsSummary> {
  if (!isDatabaseConfigured()) {
    return getMemoryAnalytics();
  }

  const [
    interactionSummary,
    statusSummary,
    actionSummary,
    feedbackSummary,
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
              status = 'success' AND
              tx_hash IS NOT NULL
          )::INT
            AS successful_transactions,

          COUNT(
            DISTINCT wallet_address
          ) FILTER (
            WHERE
              status = 'success' AND
              tx_hash IS NOT NULL
          )::INT
            AS verified_active_wallets
        FROM interactions
      `
    ),

    queryDatabase<StatusCountRow>(
      `
        SELECT
          status,
          COUNT(*)::INT AS count
        FROM interactions
        GROUP BY status
      `
    ),

    queryDatabase<ActionCountRow>(
      `
        SELECT
          action,
          COUNT(*)::INT AS count
        FROM interactions
        GROUP BY action
        ORDER BY count DESC
      `
    ),

    queryDatabase<FeedbackSummaryRow>(
      `
        SELECT
          COUNT(*)::INT
            AS total_feedback,

          COALESCE(
            ROUND(
              AVG(rating)::NUMERIC,
              2
            ),
            0
          )
            AS average_rating
        FROM feedback
      `
    ),

    queryDatabase<InteractionRow>(
      `
        SELECT
          id,
          user_id,
          wallet_address,
          action,
          status,
          tx_hash,
          contract_function,
          network,
          metadata,
          created_at
        FROM interactions
        ORDER BY created_at DESC
        LIMIT 1
      `
    ),

    queryDatabase<FeedbackRow>(
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
        LIMIT 1
      `
    ),
  ]);

  const interactionStatusCounts:
  Record<InteractionStatus, number> = {
    pending: 0,
    success: 0,
    failed: 0,
  };

  for (
    const row of
    statusSummary.rows
  ) {
    interactionStatusCounts[
      row.status
    ] = Number(row.count);
  }

  const actionCounts:
  Record<string, number> = {};

  for (
    const row of
    actionSummary.rows
  ) {
    actionCounts[row.action] =
      Number(row.count);
  }

  const interactionRow =
    interactionSummary.rows[0];

  const feedbackRow =
    feedbackSummary.rows[0];

  return {
    totalInteractions:
      Number(
        interactionRow
          ?.total_interactions || 0
      ),

    uniqueWallets:
      Number(
        interactionRow
          ?.unique_wallets || 0
      ),

    successfulTransactions:
      Number(
        interactionRow
          ?.successful_transactions ||
          0
      ),

    verifiedActiveWallets:
      Number(
        interactionRow
          ?.verified_active_wallets ||
          0
      ),

    interactionStatusCounts,
    actionCounts,

    totalFeedback:
      Number(
        feedbackRow
          ?.total_feedback || 0
      ),

    averageRating:
      Number(
        feedbackRow
          ?.average_rating || 0
      ),

    latestInteraction:
      latestInteractions.rows[0]
        ? mapInteractionRow(
            latestInteractions.rows[0]
          )
        : null,

    latestFeedback:
      latestFeedbackEntries.rows[0]
        ? mapFeedbackRow(
            latestFeedbackEntries
              .rows[0]
          )
        : null,
  };
}

export function clearDataForTests():
void {
  interactions.length = 0;
  feedbackEntries.length = 0;
}
