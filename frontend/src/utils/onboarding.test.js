import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createOnboardingProfile,
  isValidStellarWalletAddress,
  normalizeWalletAddress,
} from "./onboarding";

const TEST_WALLET =
  `G${"A".repeat(55)}`;

describe(
  "wallet-only onboarding helpers",
  () => {
    it(
      "normalizes a Stellar wallet address",
      () => {
        expect(
          normalizeWalletAddress(
            `  ${TEST_WALLET.toLowerCase()}  `
          )
        ).toBe(TEST_WALLET);
      }
    );

    it(
      "returns an empty value for non-string input",
      () => {
        expect(
          normalizeWalletAddress(null)
        ).toBe("");

        expect(
          normalizeWalletAddress(
            undefined
          )
        ).toBe("");
      }
    );

    it(
      "validates Stellar public keys",
      () => {
        expect(
          isValidStellarWalletAddress(
            TEST_WALLET
          )
        ).toBe(true);

        expect(
          isValidStellarWalletAddress(
            "INVALID_WALLET"
          )
        ).toBe(false);
      }
    );

    it(
      "creates a wallet-only onboarding payload",
      () => {
        expect(
          createOnboardingProfile({
            walletAddress:
              TEST_WALLET.toLowerCase(),
          })
        ).toEqual({
          walletAddress:
            TEST_WALLET,
        });
      }
    );

    it(
      "does not include personal information",
      () => {
        const profile =
          createOnboardingProfile({
            walletAddress:
              TEST_WALLET,

            name:
              "This value is ignored",

            email:
              "ignored@example.com",
          });

        expect(profile).toEqual({
          walletAddress:
            TEST_WALLET,
        });

        expect(profile).not.toHaveProperty(
          "name"
        );

        expect(profile).not.toHaveProperty(
          "email"
        );
      }
    );

    it(
      "rejects onboarding without a valid wallet",
      () => {
        expect(() =>
          createOnboardingProfile({
            walletAddress: "",
          })
        ).toThrow(
          "Connect a valid Stellar wallet"
        );
      }
    );
  }
);
