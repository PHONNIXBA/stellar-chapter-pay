import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createOnboardingProfile,
  isValidOnboardingEmail,
  isValidOnboardingName,
  isValidStellarWalletAddress,
  normalizeOnboardingEmail,
  normalizeOnboardingName,
} from "./onboarding";

const TEST_WALLET =
  `G${"A".repeat(55)}`;

describe(
  "onboarding profile helpers",
  () => {
    it(
      "normalizes a user name and email",
      () => {
        expect(
          normalizeOnboardingName(
            "  Test    User  "
          )
        ).toBe("Test User");

        expect(
          normalizeOnboardingEmail(
            " TEST.USER@EXAMPLE.COM "
          )
        ).toBe(
          "test.user@example.com"
        );
      }
    );

    it(
      "validates supported names",
      () => {
        expect(
          isValidOnboardingName(
            "Test User"
          )
        ).toBe(true);

        expect(
          isValidOnboardingName("A")
        ).toBe(false);
      }
    );

    it(
      "validates email addresses",
      () => {
        expect(
          isValidOnboardingEmail(
            "user@example.com"
          )
        ).toBe(true);

        expect(
          isValidOnboardingEmail(
            "invalid-email"
          )
        ).toBe(false);
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
      "creates a normalized onboarding payload",
      () => {
        expect(
          createOnboardingProfile({
            name:
              "  Level Five User  ",

            email:
              "LEVEL5@EXAMPLE.COM",

            walletAddress:
              TEST_WALLET.toLowerCase(),
          })
        ).toEqual({
          name: "Level Five User",

          email:
            "level5@example.com",

          walletAddress:
            TEST_WALLET,
        });
      }
    );

    it(
      "rejects registration without a valid wallet",
      () => {
        expect(() =>
          createOnboardingProfile({
            name: "Test User",

            email:
              "test@example.com",

            walletAddress: "",
          })
        ).toThrow(
          "Connect a valid Stellar wallet"
        );
      }
    );
  }
);
