import request from "supertest";

import {
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import { app } from "./index";

import {
  clearDataForTests,
} from "./services/dataService";

import {
  clearUsersForTests,
} from "./services/userService";

const ORIGINAL_DATABASE_URL =
  process.env.DATABASE_URL;

const ORIGINAL_EXPORT_API_KEY =
  process.env.EXPORT_API_KEY;

const FIRST_WALLET =
  `G${"A".repeat(55)}`;

beforeEach(() => {
  delete process.env.DATABASE_URL;

  process.env.EXPORT_API_KEY =
    "test-export-api-key";

  clearDataForTests();
  clearUsersForTests();
});

afterAll(() => {
  if (
    ORIGINAL_DATABASE_URL ===
    undefined
  ) {
    delete process.env.DATABASE_URL;
  }
  else {
    process.env.DATABASE_URL =
      ORIGINAL_DATABASE_URL;
  }

  if (
    ORIGINAL_EXPORT_API_KEY ===
    undefined
  ) {
    delete process.env.EXPORT_API_KEY;
  }
  else {
    process.env.EXPORT_API_KEY =
      ORIGINAL_EXPORT_API_KEY;
  }
});

describe(
  "health and configuration endpoints",
  () => {
    it(
      "returns backend health information",
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
          typeof response.body
            .timestamp
        ).toBe("string");
      }
    );

    it(
      "returns Stellar runtime configuration",
      async () => {
        const response =
          await request(app)
            .get("/api/config")
            .expect(200);

        expect(
          response.body.network
        ).toBe("TESTNET");

        expect(
          response.body.rpcUrl
        ).toContain("stellar.org");

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
          Array.isArray(
            response.body.functions
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
  "user onboarding endpoints",
  () => {
    it(
      "registers a user and maps the profile to a wallet",
      async () => {
        const response =
          await request(app)
            .post("/api/users")
            .send({
              name: "Test User",

              email:
                "TEST.USER@EXAMPLE.COM",

              walletAddress:
                FIRST_WALLET,
            })
            .expect(201);

        expect(
          response.body.user.name
        ).toBe("Test User");

        expect(
          response.body.user.email
        ).toBe(
          "test.user@example.com"
        );

        expect(
          response.body.user
            .walletAddress
        ).toBe(FIRST_WALLET);

        expect(
          response.body.user
            .onboardingStatus
        ).toBe("registered");
      }
    );

    it(
      "returns a registered user by wallet",
      async () => {
        await request(app)
          .post("/api/users")
          .send({
            name: "Wallet User",

            email:
              "wallet@example.com",

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
          response.body.user.email
        ).toBe(
          "wallet@example.com"
        );
      }
    );

    it(
      "lists registered users",
      async () => {
        await request(app)
          .post("/api/users")
          .send({
            name: "List User",

            email:
              "list@example.com",

            walletAddress:
              FIRST_WALLET,
          })
          .expect(201);

        const response =
          await request(app)
            .get("/api/users")
            .expect(200);

        expect(
          response.body.count
        ).toBe(1);

        expect(
          response.body.users
        ).toHaveLength(1);
      }
    );

    it(
      "rejects an invalid wallet during registration",
      async () => {
        const response =
          await request(app)
            .post("/api/users")
            .send({
              name: "Invalid User",

              email:
                "invalid@example.com",

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
      "returns 404 for an unregistered wallet",
      async () => {
        const response =
          await request(app)
            .get(
              `/api/users/${FIRST_WALLET}`
            )
            .expect(404);

        expect(
          response.body.error
        ).toBe(
          "User was not found."
        );
      }
    );
  }
);

describe(
  "interaction endpoints",
  () => {
    it(
      "records a valid wallet interaction",
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

              contractFunction:
                "unlock_with_payment",

              status: "success",

              txHash:
                "test-transaction-hash",

              network: "TESTNET",

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
            .status
        ).toBe("success");

        expect(
          response.body.interaction
            .txHash
        ).toBe(
          "test-transaction-hash"
        );
      }
    );

    it(
      "returns recorded interactions",
      async () => {
        await request(app)
          .post("/api/interactions")
          .send({
            walletAddress:
              FIRST_WALLET,

            action:
              "wallet_connected",

            status: "success",
          })
          .expect(201);

        const response =
          await request(app)
            .get(
              "/api/interactions"
            )
            .expect(200);

        expect(
          response.body.count
        ).toBe(1);

        expect(
          response.body.interactions
        ).toHaveLength(1);
      }
    );

    it(
      "rejects an invalid interaction",
      async () => {
        const response =
          await request(app)
            .post(
              "/api/interactions"
            )
            .send({
              action:
                "chapters_unlocked",

              status: "unknown",
            })
            .expect(400);

        expect(
          response.body.error
        ).toContain(
          "walletAddress"
        );
      }
    );
  }
);

describe(
  "feedback and analytics endpoints",
  () => {
    it(
      "records valid user feedback",
      async () => {
        const response =
          await request(app)
            .post("/api/feedback")
            .send({
              walletAddress:
                FIRST_WALLET,

              rating: 5,

              comment:
                "The bulk chapter payment flow was clear.",

              improvementCategory:
                "onboarding",
            })
            .expect(201);

        expect(
          response.body.feedback
            .rating
        ).toBe(5);

        expect(
          response.body.feedback
            .improvementCategory
        ).toBe("onboarding");
      }
    );

    it(
      "rejects a rating outside the supported range",
      async () => {
        const response =
          await request(app)
            .post("/api/feedback")
            .send({
              rating: 8,
              comment:
                "Invalid rating",
            })
            .expect(400);

        expect(
          response.body.error
        ).toContain("rating");
      }
    );

    it(
      "returns an analytics summary",
      async () => {
        await request(app)
          .post("/api/interactions")
          .send({
            walletAddress:
              FIRST_WALLET,

            action:
              "chapters_unlocked",

            status: "success",

            txHash:
              "analytics-test-hash",
          })
          .expect(201);

        const response =
          await request(app)
            .get("/api/analytics")
            .expect(200);

        expect(
          response.body
            .totalInteractions
        ).toBe(1);

        expect(
          response.body
            .successfulTransactions
        ).toBe(1);

        expect(
          response.body
            .verifiedActiveWallets
        ).toBe(1);
      }
    );

    it(
      "returns Level 5 product statistics",
      async () => {
        await request(app)
          .post("/api/users")
          .send({
            name:
              "Statistics User",

            email:
              "statistics@example.com",

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

            contractFunction:
              "unlock_with_payment",

            status:
              "success",

            txHash:
              "statistics-testnet-hash",
          })
          .expect(201);

        await request(app)
          .post("/api/feedback")
          .send({
            walletAddress:
              FIRST_WALLET,

            rating: 5,

            comment:
              "The Level 5 dashboard was clear.",

            improvementCategory:
              "ui-ux",
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
            .totalInteractions
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

        expect(
          typeof response.body.stats
            .updatedAt
        ).toBe("string");
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

        expect(
          response.body.checks
            .frontendIntegration
        ).toBe(true);
      }
    );
  }
);

describe(
  "protected Level 5 export endpoint",
  () => {
    it(
      "rejects a request with an invalid export key",
      async () => {
        const response =
          await request(app)
            .get(
              "/api/exports/level-5.csv"
            )
            .set(
              "x-export-api-key",
              "wrong-key"
            )
            .expect(401);

        expect(
          response.body.error
        ).toContain(
          "valid export API key"
        );
      }
    );

    it(
      "reports when the export service is not configured",
      async () => {
        delete process.env
          .EXPORT_API_KEY;

        const response =
          await request(app)
            .get(
              "/api/exports/level-5.csv"
            )
            .set(
              "x-export-api-key",
              "test-export-api-key"
            )
            .expect(503);

        expect(
          response.body.error
        ).toContain(
          "not configured"
        );
      }
    );

    it(
      "downloads an Excel-compatible CSV with the correct key",
      async () => {
        await request(app)
          .post("/api/users")
          .send({
            name: "Export User",

            email:
              "export@example.com",

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

            contractFunction:
              "unlock_with_payment",

            status: "success",

            txHash:
              "export-testnet-hash",
          })
          .expect(201);

        await request(app)
          .post("/api/feedback")
          .send({
            walletAddress:
              FIRST_WALLET,

            rating: 5,

            comment:
              "Export feedback",

            improvementCategory:
              "onboarding",
          })
          .expect(201);

        const response =
          await request(app)
            .get(
              "/api/exports/level-5.csv"
            )
            .set(
              "x-export-api-key",
              "test-export-api-key"
            )
            .expect(200);

        expect(
          response.headers[
            "content-type"
          ]
        ).toContain(
          "text/csv"
        );

        expect(
          response.headers[
            "content-disposition"
          ]
        ).toMatch(
          /stellar-chapter-pay-level-5-\d{4}-\d{2}-\d{2}\.csv/
        );

        expect(
          response.headers[
            "cache-control"
          ]
        ).toContain("no-store");

        expect(response.text).toContain(
          "User ID,Name,Email,Wallet"
        );

        expect(response.text).toContain(
          "export@example.com"
        );

        expect(response.text).toContain(
          "export-testnet-hash"
        );

        expect(response.text).toContain(
          "Export feedback"
        );
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
