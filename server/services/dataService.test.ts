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
} from "./userService";

const ORIGINAL_DATABASE_URL =
  process.env.DATABASE_URL;

const TEST_WALLET =
  `G${"C".repeat(55)}`;

const TEST_CONTRACT =
  `C${"F".repeat(55)}`;

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
      "automatically registers the wallet and stores contract evidence",
      async () => {
        const interaction =
          await createInteraction({
            walletAddress:
              TEST_WALLET,

            action:
              "chapters_unlocked",

            contractId:
              TEST_CONTRACT,

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
        ).not.toBeNull();

        expect(
          interaction.contractId
        ).toBe(TEST_CONTRACT);

        expect(
          interaction.network
        ).toBe("TESTNET");

        expect(
          interaction.contractFunction
        ).toBe(
          "unlock_with_payment"
        );

        const user =
          await getUserByWallet(
            TEST_WALLET
          );

        expect(user).not.toBeNull();

        expect(
          user?.onboardingStatus
        ).toBe("active");

        expect(
          user?.onboardingCompleted
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

    it(
      "rejects an invalid contract ID",
      async () => {
        await expect(
          createInteraction({
            walletAddress:
              TEST_WALLET,

            action:
              "chapters_unlocked",

            contractId:
              "INVALID_CONTRACT",

            status: "success",
          })
        ).rejects.toThrow(
          "valid Stellar contract ID"
        );
      }
    );
  }
);

describe(
  "wallet feedback storage",
  () => {
    it(
      "stores feedback using the wallet as identity",
      async () => {
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
        ).not.toBeNull();

        expect(
          feedback.walletAddress
        ).toBe(TEST_WALLET);

        expect(
          feedback.improvementCategory
        ).toBe("onboarding");

        expect(feedback).not.toHaveProperty(
          "name"
        );

        expect(feedback).not.toHaveProperty(
          "email"
        );

        const records =
          await listFeedback();

        expect(records).toHaveLength(1);
      }
    );

    it(
      "rejects a rating outside the supported range",
      async () => {
        await expect(
          createFeedback({
            walletAddress:
              TEST_WALLET,

            rating: 6,

            comment:
              "Invalid rating.",
          })
        ).rejects.toThrow(
          "integer from 1 to 5"
        );
      }
    );
  }
);

describe(
  "wallet analytics",
  () => {
    it(
      "counts verified transaction activity and feedback",
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

          contractId:
            TEST_CONTRACT,

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
