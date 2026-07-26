// @vitest-environment jsdom

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  fetchPublicEvidence,
  fetchUserByWallet,
  registerUser,
  requestJson,
} from "./api";

const EXPECTED_API_BASE_URL =
  import.meta.env
    .VITE_API_BASE_URL
    ?.trim()
    ?.replace(/\/+$/, "") ||
  "http://localhost:3001";

function createJsonResponse(
  body,
  status = 200
) {
  return {
    ok:
      status >= 200 &&
      status < 300,

    status,

    headers: {
      get: vi
        .fn()
        .mockReturnValue(
          "application/json"
        ),
    },

    json: vi
      .fn()
      .mockResolvedValue(body),

    text: vi
      .fn()
      .mockResolvedValue(
        JSON.stringify(body)
      ),
  };
}

describe(
  "frontend wallet-only API service",
  () => {
    let fetchMock;

    beforeEach(() => {
      fetchMock = vi.fn();

      vi.stubGlobal(
        "fetch",
        fetchMock
      );
    });

    it(
      "registers only a normalized wallet address",
      async () => {
        fetchMock.mockResolvedValue(
          createJsonResponse(
            {
              user: {
                walletAddress:
                  "GABC123",

                onboardingCompleted:
                  true,
              },
            },
            201
          )
        );

        await registerUser({
          walletAddress:
            "  gabc123  ",

          name:
            "Ignored name",

          email:
            "ignored@example.com",
        });

        expect(
          fetchMock
        ).toHaveBeenCalledTimes(1);

        const [
          requestUrl,
          requestOptions,
        ] =
          fetchMock.mock.calls[0];

        expect(requestUrl).toBe(
          `${EXPECTED_API_BASE_URL}/api/users`
        );

        expect(
          requestOptions.method
        ).toBe("POST");

        expect(
          JSON.parse(
            requestOptions.body
          )
        ).toEqual({
          walletAddress:
            "GABC123",
        });
      }
    );

    it(
      "loads a wallet profile using an encoded address",
      async () => {
        fetchMock.mockResolvedValue(
          createJsonResponse({
            user: {
              walletAddress:
                "GABC/TEST",
            },
          })
        );

        await fetchUserByWallet(
          "GABC/TEST"
        );

        expect(
          fetchMock
        ).toHaveBeenCalledWith(
          `${EXPECTED_API_BASE_URL}/api/users/GABC%2FTEST`,
          expect.objectContaining({
            method: "GET",
          })
        );
      }
    );

    it(
      "loads the public evidence table",
      async () => {
        fetchMock.mockResolvedValue(
          createJsonResponse({
            count: 0,

            summary: {
              totalWallets: 0,
            },

            records: [],
          })
        );

        await fetchPublicEvidence();

        expect(
          fetchMock
        ).toHaveBeenCalledWith(
          `${EXPECTED_API_BASE_URL}/api/evidence`,
          expect.objectContaining({
            method: "GET",
          })
        );
      }
    );



    it(
      "surfaces a backend wallet validation error",
      async () => {
        fetchMock.mockResolvedValue(
          createJsonResponse(
            {
              error:
                "A valid Stellar wallet address is required.",
            },
            400
          )
        );

        await expect(
          registerUser({
            walletAddress:
              "INVALID",
          })
        ).rejects.toThrow(
          "A valid Stellar wallet address is required."
        );
      }
    );

    it(
      "supports successful responses without a body",
      async () => {
        fetchMock.mockResolvedValue({
          ok: true,
          status: 204,

          headers: {
            get: vi
              .fn()
              .mockReturnValue(""),
          },

          json: vi.fn(),
          text: vi.fn(),
        });

        await expect(
          requestJson(
            "/api/no-content"
          )
        ).resolves.toBeNull();
      }
    );
  }
);
