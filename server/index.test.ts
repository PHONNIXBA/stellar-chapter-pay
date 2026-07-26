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
  clearUsersForTests,
} from "./services/userService";

const ORIGINAL_DATABASE_URL =
  process.env.DATABASE_URL;

const FIRST_WALLET =
  `G${"A".repeat(55)}`;

beforeEach(() => {
  delete process.env.DATABASE_URL;
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
                "GTESTWALLETADDRESS",
              action:
                "chapters_unlocked",
              status: "success",
              txHash:
                "test-transaction-hash",
              metadata: {
                quantity: 3,
                totalPrice: 15,
              },
            })
            .expect(201);

        expect(
          response.body.interaction
            .walletAddress
        ).toBe(
          "GTESTWALLETADDRESS"
        );

        expect(
          response.body.interaction
            .action
        ).toBe(
          "chapters_unlocked"
        );

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
        const response =
          await request(app)
            .get(
              "/api/interactions"
            )
            .expect(200);

        expect(
          Array.isArray(
            response.body
              .interactions
          )
        ).toBe(true);

        expect(
          response.body.count
        ).toBeGreaterThanOrEqual(
          1
        );
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
                "GTESTWALLETADDRESS",
              rating: 5,
              comment:
                "The bulk chapter payment flow was clear.",
            })
            .expect(201);

        expect(
          response.body.feedback
            .rating
        ).toBe(5);

        expect(
          response.body.feedback
            .comment
        ).toContain(
          "chapter payment"
        );
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
        const response =
          await request(app)
            .get("/api/analytics")
            .expect(200);

        expect(
          response.body
            .totalInteractions
        ).toBeGreaterThanOrEqual(
          1
        );

        expect(
          response.body
            .totalFeedback
        ).toBeGreaterThanOrEqual(
          1
        );

        expect(
          typeof response.body
            .averageRating
        ).toBe("number");
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

        expect(
          response.body
            .functionCoverage
            .total
        ).toBeGreaterThan(10);
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
