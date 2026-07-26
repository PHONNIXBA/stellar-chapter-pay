import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  getAdminApiKey,
  securelyMatchesApiKey,
} from "./adminAuth";

const ORIGINAL_ADMIN_API_KEY =
  process.env.ADMIN_API_KEY;

afterEach(() => {
  if (
    ORIGINAL_ADMIN_API_KEY ===
    undefined
  ) {
    delete process.env
      .ADMIN_API_KEY;

    return;
  }

  process.env.ADMIN_API_KEY =
    ORIGINAL_ADMIN_API_KEY;
});

describe(
  "admin API key security",
  () => {
    it(
      "returns the configured admin key",
      () => {
        process.env.ADMIN_API_KEY =
          "  secure-admin-key  ";

        expect(
          getAdminApiKey()
        ).toBe(
          "secure-admin-key"
        );
      }
    );

    it(
      "returns null when the admin key is not configured",
      () => {
        delete process.env
          .ADMIN_API_KEY;

        expect(
          getAdminApiKey()
        ).toBeNull();
      }
    );

    it(
      "matches equal API keys",
      () => {
        expect(
          securelyMatchesApiKey(
            "secure-key",
            "secure-key"
          )
        ).toBe(true);
      }
    );

    it(
      "rejects different API keys",
      () => {
        expect(
          securelyMatchesApiKey(
            "secure-key",
            "wrong-key"
          )
        ).toBe(false);
      }
    );

    it(
      "rejects keys with different lengths",
      () => {
        expect(
          securelyMatchesApiKey(
            "long-secure-key",
            "short"
          )
        ).toBe(false);
      }
    );
  }
);
