import { randomUUID } from "node:crypto";

export type InteractionStatus =
  | "pending"
  | "success"
  | "failed";

export interface InteractionInput {
  walletAddress: string;
  action: string;
  status: InteractionStatus;
  txHash?: string;
  metadata?: Record<string, unknown>;
}

export interface InteractionRecord
  extends InteractionInput {
  id: string;
  createdAt: string;
}

export interface FeedbackInput {
  walletAddress?: string;
  rating: number;
  comment: string;
}

export interface FeedbackRecord
  extends FeedbackInput {
  id: string;
  createdAt: string;
}

const MAX_RECORDS = 500;

const interactions: InteractionRecord[] = [];
const feedbackEntries: FeedbackRecord[] = [];

function normalizeLimit(
  limit: number,
  maximum = 100
): number {
  if (!Number.isInteger(limit) || limit <= 0) {
    return 50;
  }

  return Math.min(limit, maximum);
}

export function createInteraction(
  input: InteractionInput
): InteractionRecord {
  const interaction: InteractionRecord = {
    id: randomUUID(),
    ...input,
    createdAt: new Date().toISOString(),
  };

  interactions.unshift(interaction);

  if (interactions.length > MAX_RECORDS) {
    interactions.length = MAX_RECORDS;
  }

  return interaction;
}

export function listInteractions(
  limit = 50
): InteractionRecord[] {
  return interactions
    .slice(0, normalizeLimit(limit))
    .map((interaction) => ({
      ...interaction,
      metadata: interaction.metadata
        ? { ...interaction.metadata }
        : undefined,
    }));
}

export function createFeedback(
  input: FeedbackInput
): FeedbackRecord {
  const feedback: FeedbackRecord = {
    id: randomUUID(),
    ...input,
    createdAt: new Date().toISOString(),
  };

  feedbackEntries.unshift(feedback);

  if (feedbackEntries.length > MAX_RECORDS) {
    feedbackEntries.length = MAX_RECORDS;
  }

  return feedback;
}

export function listFeedback(
  limit = 50
): FeedbackRecord[] {
  return feedbackEntries
    .slice(0, normalizeLimit(limit))
    .map((feedback) => ({
      ...feedback,
    }));
}

export function getAnalyticsSummary() {
  const interactionStatusCounts =
    interactions.reduce<
      Record<InteractionStatus, number>
    >(
      (summary, interaction) => {
        summary[interaction.status] += 1;
        return summary;
      },
      {
        pending: 0,
        success: 0,
        failed: 0,
      }
    );

  const actionCounts = interactions.reduce<
    Record<string, number>
  >(
    (summary, interaction) => {
      summary[interaction.action] =
        (summary[interaction.action] || 0) +
        1;

      return summary;
    },
    {}
  );

  const averageRating =
    feedbackEntries.length === 0
      ? 0
      : Number(
          (
            feedbackEntries.reduce(
              (total, feedback) =>
                total + feedback.rating,
              0
            ) / feedbackEntries.length
          ).toFixed(2)
        );

  const uniqueWallets = new Set(
    interactions
      .map(
        (interaction) =>
          interaction.walletAddress
      )
      .filter(Boolean)
  );

  return {
    totalInteractions: interactions.length,
    uniqueWallets: uniqueWallets.size,
    interactionStatusCounts,
    actionCounts,
    totalFeedback: feedbackEntries.length,
    averageRating,
    latestInteraction:
      interactions[0] || null,
    latestFeedback:
      feedbackEntries[0] || null,
  };
}