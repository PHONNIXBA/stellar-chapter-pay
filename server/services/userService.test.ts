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
  "wallet-only user registration",
  () => {
    it(
      "registers a user using only a Stellar wallet",
      async () => {
        const user =
          await registerUser({
            walletAddress:
              FIRST_WALLET.toLowerCase(),
          });

        expect(
          user.walletAddress
        ).toBe(FIRST_WALLET);

        expect(
          user.onboardingStatus
        ).toBe(
          "wallet_connected"
        );

        expect(
          user.onboardingCompleted
        ).toBe(true);

        expect(user).not.toHaveProperty(
          "name"
        );

        expect(user).not.toHaveProperty(
          "email"
        );
      }
    );

    it(
      "does not create a duplicate for the same wallet",
      async () => {
        const originalUser =
          await registerUser({
            walletAddress:
              FIRST_WALLET,
          });

        const updatedUser =
          await registerUser({
            walletAddress:
              FIRST_WALLET,
          });

        expect(
          updatedUser.id
        ).toBe(originalUser.id);

        expect(
          updatedUser.walletAddress
        ).toBe(FIRST_WALLET);

        const users =
          await listUsers();

        expect(users).toHaveLength(1);
      }
    );

    it(
      "returns a registered user by wallet",
      async () => {
        await registerUser({
          walletAddress:
            FIRST_WALLET,
        });

        const user =
          await getUserByWallet(
            FIRST_WALLET
          );

        expect(user).not.toBeNull();

        expect(
          user?.walletAddress
        ).toBe(FIRST_WALLET);
      }
    );

    it(
      "returns null for an unknown wallet",
      async () => {
        const user =
          await getUserByWallet(
            FIRST_WALLET
          );

        expect(user).toBeNull();
      }
    );

    it(
      "lists multiple wallets",
      async () => {
        await registerUser({
          walletAddress:
            FIRST_WALLET,
        });

        await registerUser({
          walletAddress:
            SECOND_WALLET,
        });

        const users =
          await listUsers();

        expect(users).toHaveLength(2);

        expect(
          users.map(
            (user) =>
              user.walletAddress
          )
        ).toEqual(
          expect.arrayContaining([
            FIRST_WALLET,
            SECOND_WALLET,
          ])
        );
      }
    );

    it(
      "rejects an invalid wallet address",
      async () => {
        await expect(
          registerUser({
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
  "wallet activity",
  () => {
    it(
      "marks a wallet as connected",
      async () => {
        await registerUser({
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
        ).toBe(true);

        expect(
          user?.lastActiveAt
        ).not.toBeNull();
      }
    );

    it(
      "marks a verified product wallet as active",
      async () => {
        await registerUser({
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
      "returns null for activity from an unknown wallet",
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
