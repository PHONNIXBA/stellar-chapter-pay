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
  getAnalyticsSummary,
  listFeedback,
  listInteractions,
} from "./dataService";

import {
  clearUsersForTests,
  getUserByWallet,
  registerUser,
} from "./userService";

const ORIGINAL_DATABASE_URL =
  process.env.DATABASE_URL;

const TEST_WALLET =
  `G${"C".repeat(55)}`;

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
  "wallet interaction storage",
  () => {
    it(
      "links a successful transaction to a registered user",
      async () => {
        const user =
          await registerUser({
            name: "Activity User",
            email:
              "activity@example.com",
            walletAddress:
              TEST_WALLET,
          });

        const interaction =
          await createInteraction({
            walletAddress:
              TEST_WALLET,

            action:
              "chapters_unlocked",

            contractFunction:
              "unlock_with_payment",

            status: "success",

            txHash:
              "testnet-transaction-hash",

            metadata: {
              quantity: 2,
              totalPrice: 10,
            },
          });

        expect(
          interaction.userId
        ).toBe(user.id);

        expect(
          interaction.network
        ).toBe("TESTNET");

        expect(
          interaction
            .contractFunction
        ).toBe(
          "unlock_with_payment"
        );

        const updatedUser =
          await getUserByWallet(
            TEST_WALLET
          );

        expect(
          updatedUser
            ?.onboardingStatus
        ).toBe("active");

        expect(
          updatedUser
            ?.onboardingCompleted
        ).toBe(true);
      }
    );

    it(
      "returns stored interactions",
      async () => {
        await createInteraction({
          walletAddress:
            TEST_WALLET,

          action:
            "wallet_connected",

          status: "success",
        });

        const records =
          await listInteractions();

        expect(records).toHaveLength(1);

        expect(
          records[0].action
        ).toBe(
          "wallet_connected"
        );
      }
    );
  }
);

describe(
  "feedback storage",
  () => {
    it(
      "links feedback to a registered user",
      async () => {
        const user =
          await registerUser({
            name: "Feedback User",
            email:
              "feedback@example.com",
            walletAddress:
              TEST_WALLET,
          });

        const feedback =
          await createFeedback({
            walletAddress:
              TEST_WALLET,

            rating: 5,

            comment:
              "The chapter payment flow was easy to understand.",

            improvementCategory:
              "onboarding",
          });

        expect(
          feedback.userId
        ).toBe(user.id);

        expect(
          feedback
            .improvementCategory
        ).toBe("onboarding");

        const records =
          await listFeedback();

        expect(records).toHaveLength(1);
      }
    );
  }
);

describe(
  "persistent analytics shape",
  () => {
    it(
      "counts verified transaction activity",
      async () => {
        await createInteraction({
          walletAddress:
            TEST_WALLET,

          action:
            "transaction_pending",

          status: "pending",
        });

        await createInteraction({
          walletAddress:
            TEST_WALLET,

          action:
            "chapters_unlocked",

          status: "success",

          txHash:
            "verified-testnet-hash",
        });

        await createFeedback({
          walletAddress:
            TEST_WALLET,

          rating: 4,

          comment:
            "The product worked correctly.",
        });

        const summary =
          await getAnalyticsSummary();

        expect(
          summary.totalInteractions
        ).toBe(2);

        expect(
          summary.successfulTransactions
        ).toBe(1);

        expect(
          summary.verifiedActiveWallets
        ).toBe(1);

        expect(
          summary.totalFeedback
        ).toBe(1);

        expect(
          summary.averageRating
        ).toBe(4);
      }
    );
  }
);
