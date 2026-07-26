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
  buildLevel5Csv,
  buildLevel5ExportRows,
  createLevel5ExportFilename,
} from "./exportService";

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
  "Level 5 export rows",
  () => {
    it(
      "joins users with their latest activity and feedback",
      async () => {
        const user =
          await registerUser({
            name: "Export User",

            email:
              "export@example.com",

            walletAddress:
              FIRST_WALLET,
          });

        await createInteraction({
          walletAddress:
            FIRST_WALLET,

          action:
            "transaction_pending",

          status: "pending",

          contractFunction:
            "unlock_with_payment",
        });

        await createInteraction({
          walletAddress:
            FIRST_WALLET,

          action:
            "chapters_unlocked",

          status: "success",

          txHash:
            "level-5-testnet-hash",

          contractFunction:
            "unlock_with_payment",

          network: "TESTNET",
        });

        await createFeedback({
          walletAddress:
            FIRST_WALLET,

          rating: 5,

          comment:
            "The payment flow was clear.",

          improvementCategory:
            "onboarding",
        });

        const rows =
          await buildLevel5ExportRows();

        expect(rows).toHaveLength(1);

        expect(
          rows[0].userId
        ).toBe(user.id);

        expect(
          rows[0].mainAction
        ).toBe(
          "chapters_unlocked"
        );

        expect(
          rows[0].transactionHash
        ).toBe(
          "level-5-testnet-hash"
        );

        expect(
          rows[0].transactionStatus
        ).toBe("success");

        expect(
          rows[0].rating
        ).toBe(5);

        expect(
          rows[0]
            .improvementCategory
        ).toBe("onboarding");
      }
    );

    it(
      "includes registered users without transaction activity",
      async () => {
        await registerUser({
          name: "New User",

          email:
            "new@example.com",

          walletAddress:
            SECOND_WALLET,
        });

        const rows =
          await buildLevel5ExportRows();

        expect(rows).toHaveLength(1);

        expect(
          rows[0].mainAction
        ).toBe("");

        expect(
          rows[0].transactionHash
        ).toBe("");

        expect(
          rows[0].onboardingStatus
        ).toBe("registered");
      }
    );
  }
);

describe(
  "Excel-compatible CSV",
  () => {
    it(
      "adds a UTF-8 BOM and the required Level 5 headers",
      () => {
        const csv =
          buildLevel5Csv([]);

        expect(
          csv.charCodeAt(0)
        ).toBe(0xfeff);

        expect(csv).toContain(
          "User ID,Name,Email,Wallet"
        );

        expect(csv).toContain(
          "Transaction Hash"
        );

        expect(csv).toContain(
          "Improvement Category"
        );
      }
    );

    it(
      "escapes commas, quotes, and spreadsheet formulas",
      () => {
        const csv =
          buildLevel5Csv([
            {
              userId: "user-1",
              name: "=SUM(1,1)",
              email:
                "formula@example.com",

              walletAddress:
                FIRST_WALLET,

              joinedAt:
                "2026-07-26T00:00:00.000Z",

              onboardingStatus:
                "active",

              onboardingCompleted:
                true,

              mainAction:
                "chapters_unlocked",

              contractFunction:
                "unlock_with_payment",

              transactionHash:
                "test-hash",

              transactionStatus:
                "success",

              network: "TESTNET",

              interactionDate:
                "2026-07-26T00:01:00.000Z",

              lastActiveAt:
                "2026-07-26T00:01:00.000Z",

              rating: 4,

              feedback:
                'Clear, but "slow".',

              improvementCategory:
                "performance",
            },
          ]);

        expect(csv).toContain(
          `"'=SUM(1,1)"`
        );

        expect(csv).toContain(
          `"Clear, but ""slow""."`
        );
      }
    );

    it(
      "creates a dated CSV filename",
      () => {
        const filename =
          createLevel5ExportFilename(
            new Date(
              "2026-07-26T10:00:00.000Z"
            )
          );

        expect(filename).toBe(
          "stellar-chapter-pay-level-5-2026-07-26.csv"
        );
      }
    );
  }
);
