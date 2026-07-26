import {
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  clearDataForTests,
  createFeedback,
  createInteraction,
} from "./dataService";

import {
  getLevel5Statistics,
} from "./statisticsService";

import {
  clearUsersForTests,
  registerUser,
} from "./userService";

const ORIGINAL_DATABASE_URL =
  process.env.DATABASE_URL;

const FIRST_WALLET =
  `G${"D".repeat(55)}`;

const SECOND_WALLET =
  `G${"E".repeat(55)}`;

beforeEach(() => {
  delete process.env.DATABASE_URL;

  clearDataForTests();
  clearUsersForTests();
});

afterAll(() => {
  if (
    ORIGINAL_DATABASE_URL ===
    undefined
  ) {
    delete process.env.DATABASE_URL;
    return;
  }

  process.env.DATABASE_URL =
    ORIGINAL_DATABASE_URL;
});

describe(
  "Level 5 statistics",
  () => {
    it(
      "combines registered users, transactions and feedback",
      async () => {
        await registerUser({
          name: "First User",

          email:
            "first@example.com",

          walletAddress:
            FIRST_WALLET,
        });

        await registerUser({
          name: "Second User",

          email:
            "second@example.com",

          walletAddress:
            SECOND_WALLET,
        });

        await createInteraction({
          walletAddress:
            FIRST_WALLET,

          action:
            "wallet_connected",

          status: "success",
        });

        await createInteraction({
          walletAddress:
            SECOND_WALLET,

          action:
            "chapters_unlocked",

          contractFunction:
            "unlock_with_payment",

          status: "success",

          txHash:
            "level-5-statistics-hash",
        });

        await createFeedback({
          walletAddress:
            SECOND_WALLET,

          rating: 5,

          comment:
            "The transaction flow was clear.",

          improvementCategory:
            "transaction",
        });

        const statistics =
          await getLevel5Statistics();

        expect(
          statistics.totalUsers
        ).toBe(2);

        expect(
          statistics.activeUsers
        ).toBe(1);

        expect(
          statistics
            .totalInteractions
        ).toBe(2);

        expect(
          statistics
            .successfulTransactions
        ).toBe(1);

        expect(
          statistics.feedbackCount
        ).toBe(1);

        expect(
          statistics.averageRating
        ).toBe(5);

        expect(
          Number.isNaN(
            Date.parse(
              statistics.updatedAt
            )
          )
        ).toBe(false);
      }
    );

    it(
      "returns zero values when no activity exists",
      async () => {
        const statistics =
          await getLevel5Statistics();

        expect(statistics).toMatchObject({
          totalUsers: 0,
          activeUsers: 0,
          totalInteractions: 0,
          successfulTransactions: 0,
          feedbackCount: 0,
          averageRating: 0,
        });
      }
    );
  }
);
