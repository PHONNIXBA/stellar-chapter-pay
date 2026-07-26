import type {
  QueryResultRow,
} from "pg";

import {
  getAnalyticsSummary,
} from "./dataService";

import {
  isDatabaseConfigured,
  queryDatabase,
} from "./databaseService";

import {
  listUsers,
} from "./userService";

export interface Level5Statistics {
  totalUsers: number;
  activeUsers: number;
  totalInteractions: number;
  successfulTransactions: number;
  feedbackCount: number;
  averageRating: number;
  updatedAt: string;
}

interface UserCountRow
  extends QueryResultRow {
  total_users: number;
}

async function getTotalUsers():
Promise<number> {
  if (!isDatabaseConfigured()) {
    const users =
      await listUsers(200);

    return users.length;
  }

  const result =
    await queryDatabase<UserCountRow>(
      `
        SELECT
          COUNT(*)::INT
            AS total_users
        FROM users
      `
    );

  return Number(
    result.rows[0]
      ?.total_users || 0
  );
}

export async function getLevel5Statistics():
Promise<Level5Statistics> {
  const [
    totalUsers,
    analytics,
  ] = await Promise.all([
    getTotalUsers(),
    getAnalyticsSummary(),
  ]);

  return {
    totalUsers,

    activeUsers:
      analytics
        .verifiedActiveWallets,

    totalInteractions:
      analytics.totalInteractions,

    successfulTransactions:
      analytics
        .successfulTransactions,

    feedbackCount:
      analytics.totalFeedback,

    averageRating:
      analytics.averageRating,

    updatedAt:
      new Date().toISOString(),
  };
}
