import request from "supertest";

import {
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  app,
} from "./index";

import {
  clearDataForTests,
} from "./services/dataService";

import {
  clearUsersForTests,
} from "./services/userService";

const ORIGINAL_DATABASE_URL =
  process.env.DATABASE_URL;

const ORIGINAL_ADMIN_API_KEY =
  process.env.ADMIN_API_KEY;

const ORIGINAL_EXPORT_API_KEY =
  process.env.EXPORT_API_KEY;

const ORIGINAL_PAYMENT_CONTRACT =
  process.env
    .CHAPTER_PAYMENT_CONTRACT_ID;

const ORIGINAL_TOKEN_CONTRACT =
  process.env
    .CHAPTER_TOKEN_CONTRACT_ID;

const FIRST_WALLET =
  `G${"A".repeat(55)}`;

const SECOND_WALLET =
  `G${"B".repeat(55)}`;

const PAYMENT_CONTRACT =
  `C${"F".repeat(55)}`;

const TOKEN_CONTRACT =
  `C${"G".repeat(55)}`;

function restoreEnvironmentVariable(
  name: string,
  value: string | undefined
): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

beforeEach(() => {
  delete process.env.DATABASE_URL;
  delete process.env.ADMIN_API_KEY;
  delete process.env.EXPORT_API_KEY;

  process.env
    .CHAPTER_PAYMENT_CONTRACT_ID =
    PAYMENT_CONTRACT;

  process.env
    .CHAPTER_TOKEN_CONTRACT_ID =
    TOKEN_CONTRACT;

  clearDataForTests();
  clearUsersForTests();
});

afterAll(() => {
  restoreEnvironmentVariable(
    "DATABASE_URL",
    ORIGINAL_DATABASE_URL
  );

  restoreEnvironmentVariable(
    "ADMIN_API_KEY",
    ORIGINAL_ADMIN_API_KEY
  );

  restoreEnvironmentVariable(
    "EXPORT_API_KEY",
    ORIGINAL_EXPORT_API_KEY
  );

  restoreEnvironmentVariable(
    "CHAPTER_PAYMENT_CONTRACT_ID",
    ORIGINAL_PAYMENT_CONTRACT
  );

  restoreEnvironmentVariable(
    "CHAPTER_TOKEN_CONTRACT_ID",
    ORIGINAL_TOKEN_CONTRACT
  );
});

describe(
  "health and configuration endpoints",
  () => {
    it(
      "returns wallet-only backend health information",
      async () => {
        const response =
          await request(app)
            .get("/health")
            .expect(200);

        expect(
          response.body.status
        ).toBe("ok");

        expect(
          response.body.service
        ).toBe(
          "stellar-chapter-pay-server"
        );

        expect(
          response.body.storage
        ).toBe("memory");

        expect(
          response.body.privacyModel
        ).toBe("wallet-only");

        expect(
          response.body.publicEvidence
        ).toBe("/api/evidence");

        expect(
          typeof response.body.timestamp
        ).toBe("string");
      }
    );

    it(
      "returns Stellar Testnet configuration",
      async () => {
        const response =
          await request(app)
            .get("/api/config")
            .expect(200);

        expect(
          response.body.network
        ).toBe("TESTNET");

        expect(
          response.body
            .chapterPaymentContractId
        ).toBe(PAYMENT_CONTRACT);

        expect(
          response.body
            .chapterTokenContractId
        ).toBe(TOKEN_CONTRACT);

        expect(
          response.body.explorerUrl
        ).toContain(
          "stellar.expert"
        );
      }
    );

    it(
      "returns contract function coverage",
      async () => {
        const response =
          await request(app)
            .get("/api/functions")
            .expect(200);

        expect(
          response.body.count
        ).toBeGreaterThan(10);

        expect(
          response.body.functions.some(
            (
              item: {
                name: string;
              }
            ) =>
              item.name ===
              "unlock_with_payment"
          )
        ).toBe(true);

        expect(
          response.body.functions.some(
            (
              item: {
                name: string;
              }
            ) =>
              item.name ===
              "faucet"
          )
        ).toBe(true);
      }
    );
  }
);
describe(
  "wallet-only onboarding endpoints",
  () => {
    it(
      "registers a user using only a wallet address",
      async () => {
        const response =
          await request(app)
            .post("/api/users")
            .send({
              walletAddress:
                FIRST_WALLET,
            })
            .expect(201);

        expect(
          response.body.user
            .walletAddress
        ).toBe(FIRST_WALLET);

        expect(
          response.body.user
            .onboardingStatus
        ).toBe(
          "wallet_connected"
        );

        expect(
          response.body.user
            .onboardingCompleted
        ).toBe(true);

        expect(
          response.body.user
        ).not.toHaveProperty("name");

        expect(
          response.body.user
        ).not.toHaveProperty("email");

        expect(
          response.body.user
        ).not.toHaveProperty("id");
      }
    );

    it(
      "returns a wallet-only user profile",
      async () => {
        await request(app)
          .post("/api/users")
          .send({
            walletAddress:
              FIRST_WALLET,
          })
          .expect(201);

        const response =
          await request(app)
            .get(
              `/api/users/${FIRST_WALLET}`
            )
            .expect(200);

        expect(
          response.body.user
            .walletAddress
        ).toBe(FIRST_WALLET);

        expect(
          response.body.user
        ).not.toHaveProperty("name");

        expect(
          response.body.user
        ).not.toHaveProperty("email");

        expect(
          response.body.user
        ).not.toHaveProperty("createdAt");
      }
    );

    it(
      "rejects an invalid wallet address",
      async () => {
        const response =
          await request(app)
            .post("/api/users")
            .send({
              walletAddress:
                "INVALID_WALLET",
            })
            .expect(400);

        expect(
          response.body.error
        ).toContain(
          "valid Stellar wallet"
        );
      }
    );

    it(
      "returns 404 for an unknown valid wallet",
      async () => {
        const response =
          await request(app)
            .get(
              `/api/users/${SECOND_WALLET}`
            )
            .expect(404);

        expect(
          response.body.error
        ).toBe(
          "User was not found."
        );
      }
    );

    it(
      "redirects the old user list to public evidence",
      async () => {
        const response =
          await request(app)
            .get("/api/users")
            .expect(308);

        expect(
          response.headers.location
        ).toBe("/api/evidence");
      }
    );
  }
);

describe(
  "wallet interaction endpoints",
  () => {
    it(
      "stores transaction evidence with a contract ID",
      async () => {
        const response =
          await request(app)
            .post(
              "/api/interactions"
            )
            .send({
              walletAddress:
                FIRST_WALLET,

              action:
                "chapters_unlocked",

              contractId:
                PAYMENT_CONTRACT,

              contractFunction:
                "unlock_with_payment",

              status:
                "success",

              txHash:
                "testnet-transaction-hash",

              network:
                "TESTNET",

              metadata: {
                quantity: 3,
                totalPrice: 15,
              },
            })
            .expect(201);

        expect(
          response.body.interaction
            .walletAddress
        ).toBe(FIRST_WALLET);

        expect(
          response.body.interaction
            .contractId
        ).toBe(PAYMENT_CONTRACT);

        expect(
          response.body.interaction
            .txHash
        ).toBe(
          "testnet-transaction-hash"
        );

        expect(
          response.body.interaction
            .status
        ).toBe("success");
      }
    );

    it(
      "rejects an invalid contract ID",
      async () => {
        const response =
          await request(app)
            .post(
              "/api/interactions"
            )
            .send({
              walletAddress:
                FIRST_WALLET,

              action:
                "chapters_unlocked",

              contractId:
                "INVALID_CONTRACT",

              status:
                "success",
            })
            .expect(400);

        expect(
          response.body.error
        ).toContain(
          "valid Stellar contract ID"
        );
      }
    );

    it(
      "rejects interaction data without a wallet",
      async () => {
        const response =
          await request(app)
            .post(
              "/api/interactions"
            )
            .send({
              action:
                "chapters_unlocked",

              status:
                "success",
            })
            .expect(400);

        expect(
          response.body.error
        ).toContain(
          "valid Stellar wallet"
        );
      }
    );
  }
);

describe(
  "wallet feedback endpoints",
  () => {
    it(
      "stores feedback linked only to a wallet",
      async () => {
        const response =
          await request(app)
            .post("/api/feedback")
            .send({
              walletAddress:
                FIRST_WALLET,

              rating: 5,

              comment:
                "The payment flow was clear.",

              improvementCategory:
                "onboarding",
            })
            .expect(201);

        expect(
          response.body.feedback
            .walletAddress
        ).toBe(FIRST_WALLET);

        expect(
          response.body.feedback
            .rating
        ).toBe(5);

        expect(
          response.body.feedback
            .comment
        ).toBe(
          "The payment flow was clear."
        );

        expect(
          response.body.feedback
        ).not.toHaveProperty("name");

        expect(
          response.body.feedback
        ).not.toHaveProperty("email");
      }
    );

    it(
      "requires a wallet for feedback",
      async () => {
        const response =
          await request(app)
            .post("/api/feedback")
            .send({
              rating: 5,

              comment:
                "Missing wallet.",
            })
            .expect(400);

        expect(
          response.body.error
        ).toContain(
          "valid Stellar wallet"
        );
      }
    );

    it(
      "rejects an invalid feedback rating",
      async () => {
        const response =
          await request(app)
            .post("/api/feedback")
            .send({
              walletAddress:
                FIRST_WALLET,

              rating: 8,

              comment:
                "Invalid rating.",
            })
            .expect(400);

        expect(
          response.body.error
        ).toContain("rating");
      }
    );
  }
);
describe(
  "public evidence endpoints",
  () => {
    it(
      "returns one public evidence table without API keys",
      async () => {
        await request(app)
          .post("/api/users")
          .send({
            walletAddress:
              FIRST_WALLET,
          })
          .expect(201);

        await request(app)
          .post("/api/interactions")
          .send({
            walletAddress:
              FIRST_WALLET,

            action:
              "chapters_unlocked",

            contractId:
              PAYMENT_CONTRACT,

            contractFunction:
              "unlock_with_payment",

            status:
              "success",

            txHash:
              "public-evidence-hash",

            network:
              "TESTNET",

            metadata: {
              quantity: 4,
              totalPrice: 20,
            },
          })
          .expect(201);

        await request(app)
          .post("/api/feedback")
          .send({
            walletAddress:
              FIRST_WALLET,

            rating: 5,

            comment:
              "Simple and easy to use.",
          })
          .expect(201);

        const response =
          await request(app)
            .get("/api/evidence")
            .expect(200);

        expect(
          response.body.count
        ).toBe(1);

        expect(
          response.body.records
        ).toHaveLength(1);

        const record =
          response.body.records[0];

        expect(
          record.walletAddress
        ).toBe(FIRST_WALLET);

        expect(
          record.contractId
        ).toBe(PAYMENT_CONTRACT);

        expect(
          record.transactionHash
        ).toBe(
          "public-evidence-hash"
        );

        expect(
          record.chaptersUnlocked
        ).toBe(4);

        expect(record.amount).toBe(20);
        expect(record.rating).toBe(5);

        expect(record.feedback).toBe(
          "Simple and easy to use."
        );

        expect(
          record.verification
        ).toBe("Verified");

        expect(record.network).toBe(
          "TESTNET"
        );

        expect(record).not.toHaveProperty(
          "name"
        );

        expect(record).not.toHaveProperty(
          "email"
        );

        expect(record).not.toHaveProperty(
          "createdAt"
        );

        expect(
          response.body.summary
            .totalWallets
        ).toBe(1);

        expect(
          response.body.summary
            .verifiedWallets
        ).toBe(1);

        expect(
          response.body.summary
            .verifiedTransactions
        ).toBe(1);

        expect(
          response.body.summary
            .totalChapters
        ).toBe(4);

        expect(
          response.body.summary
            .averageRating
        ).toBe(5);

        expect(
          response.headers[
            "cache-control"
          ]
        ).toContain("public");
      }
    );

    it(
      "shows a wallet without a transaction as pending",
      async () => {
        await request(app)
          .post("/api/users")
          .send({
            walletAddress:
              SECOND_WALLET,
          })
          .expect(201);

        const response =
          await request(app)
            .get("/api/evidence")
            .expect(200);

        expect(
          response.body.records[0]
            .walletAddress
        ).toBe(SECOND_WALLET);

        expect(
          response.body.records[0]
            .verification
        ).toBe("Pending");

        expect(
          response.body.records[0]
            .transactionHash
        ).toBe("");
      }
    );
  }
);

describe(
  "analytics and product readiness endpoints",
  () => {
    it(
      "returns wallet-only Level 5 statistics",
      async () => {
        await request(app)
          .post("/api/interactions")
          .send({
            walletAddress:
              FIRST_WALLET,

            action:
              "chapters_unlocked",

            contractId:
              PAYMENT_CONTRACT,

            contractFunction:
              "unlock_with_payment",

            status:
              "success",

            txHash:
              "statistics-hash",
          })
          .expect(201);

        await request(app)
          .post("/api/feedback")
          .send({
            walletAddress:
              FIRST_WALLET,

            rating: 5,

            comment:
              "Statistics feedback",
          })
          .expect(201);

        const response =
          await request(app)
            .get(
              "/api/statistics/level-5"
            )
            .expect(200);

        expect(
          response.body.stats
            .totalUsers
        ).toBe(1);

        expect(
          response.body.stats
            .activeUsers
        ).toBe(1);

        expect(
          response.body.stats
            .successfulTransactions
        ).toBe(1);

        expect(
          response.body.stats
            .feedbackCount
        ).toBe(1);

        expect(
          response.body.stats
            .averageRating
        ).toBe(5);
      }
    );

    it(
      "returns analytics without an admin key",
      async () => {
        const response =
          await request(app)
            .get("/api/analytics")
            .expect(200);

        expect(
          response.body
            .totalInteractions
        ).toBe(0);

        expect(
          response.body
            .totalFeedback
        ).toBe(0);
      }
    );

    it(
      "returns product readiness information",
      async () => {
        const response =
          await request(app)
            .get(
              "/api/product-readiness"
            )
            .expect(200);

        expect(
          response.body.status
        ).toBe(
          "ready-for-validation"
        );

        expect(
          response.body.checks
            .backendService
        ).toBe(true);
      }
    );
  }
);

describe(
  "unknown routes",
  () => {
    it(
      "returns a structured 404 response",
      async () => {
        const response =
          await request(app)
            .get(
              "/unknown-route"
            )
            .expect(404);

        expect(
          response.body.error
        ).toBe(
          "Route not found."
        );

        expect(
          response.body.path
        ).toBe(
          "/unknown-route"
        );
      }
    );
  }
);
