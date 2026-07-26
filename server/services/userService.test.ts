import {
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  clearUsersForTests,
  getUserByWallet,
  listUsers,
  markUserActivity,
  registerUser,
} from "./userService";

const ORIGINAL_DATABASE_URL =
  process.env.DATABASE_URL;

const FIRST_WALLET =
  `G${"A".repeat(55)}`;

const SECOND_WALLET =
  `G${"B".repeat(55)}`;

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
  "user registration",
  () => {
    it(
      "maps a user profile to a Stellar wallet",
      async () => {
        const user =
          await registerUser({
            name: "  Test User  ",
            email:
              "TEST.USER@EXAMPLE.COM",
            walletAddress:
              FIRST_WALLET,
          });

        expect(user.name).toBe(
          "Test User"
        );

        expect(user.email).toBe(
          "test.user@example.com"
        );

        expect(
          user.walletAddress
        ).toBe(FIRST_WALLET);

        expect(
          user.onboardingStatus
        ).toBe("registered");

        expect(
          user.onboardingCompleted
        ).toBe(false);
      }
    );

    it(
      "updates an existing wallet without creating a duplicate user",
      async () => {
        const originalUser =
          await registerUser({
            name: "Original User",
            email:
              "original@example.com",
            walletAddress:
              FIRST_WALLET,
          });

        const updatedUser =
          await registerUser({
            name: "Updated User",
            email:
              "updated@example.com",
            walletAddress:
              FIRST_WALLET,
          });

        expect(
          updatedUser.id
        ).toBe(originalUser.id);

        expect(
          updatedUser.name
        ).toBe("Updated User");

        expect(
          updatedUser.email
        ).toBe(
          "updated@example.com"
        );

        const users =
          await listUsers();

        expect(users).toHaveLength(1);
      }
    );

    it(
      "returns a registered user by wallet",
      async () => {
        await registerUser({
          name: "Wallet User",
          email:
            "wallet@example.com",
          walletAddress:
            FIRST_WALLET,
        });

        const user =
          await getUserByWallet(
            FIRST_WALLET
          );

        expect(user).not.toBeNull();

        expect(
          user?.email
        ).toBe(
          "wallet@example.com"
        );
      }
    );

    it(
      "lists multiple registered users",
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

        const users =
          await listUsers();

        expect(users).toHaveLength(2);
      }
    );

    it(
      "rejects an invalid wallet address",
      async () => {
        await expect(
          registerUser({
            name: "Invalid Wallet",
            email:
              "invalid@example.com",
            walletAddress:
              "NOT_A_STELLAR_WALLET",
          })
        ).rejects.toThrow(
          "valid Stellar wallet"
        );
      }
    );
  }
);

describe(
  "user onboarding activity",
  () => {
    it(
      "marks a registered user as wallet connected",
      async () => {
        await registerUser({
          name: "Connected User",
          email:
            "connected@example.com",
          walletAddress:
            FIRST_WALLET,
        });

        const user =
          await markUserActivity(
            FIRST_WALLET,
            "wallet_connected"
          );

        expect(
          user?.onboardingStatus
        ).toBe(
          "wallet_connected"
        );

        expect(
          user?.onboardingCompleted
        ).toBe(false);

        expect(
          user?.lastActiveAt
        ).not.toBeNull();
      }
    );

    it(
      "marks a successful product user as active",
      async () => {
        await registerUser({
          name: "Active User",
          email:
            "active@example.com",
          walletAddress:
            FIRST_WALLET,
        });

        const user =
          await markUserActivity(
            FIRST_WALLET,
            "active"
          );

        expect(
          user?.onboardingStatus
        ).toBe("active");

        expect(
          user?.onboardingCompleted
        ).toBe(true);

        expect(
          user?.lastActiveAt
        ).not.toBeNull();
      }
    );

    it(
      "returns null when activity belongs to an unregistered wallet",
      async () => {
        const user =
          await markUserActivity(
            FIRST_WALLET,
            "active"
          );

        expect(user).toBeNull();
      }
    );
  }
);
