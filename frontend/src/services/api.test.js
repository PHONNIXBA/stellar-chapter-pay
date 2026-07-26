// @vitest-environment jsdom

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  fetchUserByWallet,
  fetchUsers,
  registerUser,
  requestJson,
} from "./api";

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
  "frontend API service",
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
      "registers a normalized user profile",
      async () => {
        fetchMock.mockResolvedValue(
          createJsonResponse(
            {
              user: {
                id: "user-1",
              },
            },
            201
          )
        );

        await registerUser({
          name: "  Test User  ",

          email:
            "TEST.USER@EXAMPLE.COM",

          walletAddress:
            "gabc123",
        });

        expect(fetchMock).toHaveBeenCalledTimes(
          1
        );

        const [
          requestUrl,
          requestOptions,
        ] = fetchMock.mock.calls[0];

        expect(requestUrl).toBe(
          "http://localhost:3001/api/users"
        );

        expect(
          requestOptions.method
        ).toBe("POST");

        expect(
          JSON.parse(
            requestOptions.body
          )
        ).toEqual({
          name: "Test User",

          email:
            "test.user@example.com",

          walletAddress:
            "GABC123",
        });
      }
    );

    it(
      "loads a user by an encoded wallet value",
      async () => {
        fetchMock.mockResolvedValue(
          createJsonResponse({
            user: {
              id: "user-1",
            },
          })
        );

        await fetchUserByWallet(
          "GABC/TEST"
        );

        expect(fetchMock).toHaveBeenCalledWith(
          "http://localhost:3001/api/users/GABC%2FTEST",
          expect.objectContaining({
            method: "GET",
          })
        );
      }
    );

    it(
      "caps list requests at 200 records",
      async () => {
        fetchMock.mockResolvedValue(
          createJsonResponse({
            count: 0,
            users: [],
          })
        );

        await fetchUsers(500);

        expect(fetchMock).toHaveBeenCalledWith(
          "http://localhost:3001/api/users?limit=200",
          expect.objectContaining({
            method: "GET",
          })
        );
      }
    );

    it(
      "surfaces a backend validation error",
      async () => {
        fetchMock.mockResolvedValue(
          createJsonResponse(
            {
              error:
                "A valid email address is required.",
            },
            400
          )
        );

        await expect(
          registerUser({
            name: "Test User",
            email: "invalid-email",
            walletAddress:
              "GABC123",
          })
        ).rejects.toThrow(
          "A valid email address is required."
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
