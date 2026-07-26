import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  fetchLevel5Statistics,
} from "./statisticsApi";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe(
  "Level 5 statistics API",
  () => {
    it(
      "loads statistics from the backend",
      async () => {
        const fetchMock =
          vi.fn().mockResolvedValue({
            ok: true,
            status: 200,

            json: vi.fn()
              .mockResolvedValue({
                stats: {
                  totalUsers: 52,
                  activeUsers: 41,
                },
              }),
          });

        vi.stubGlobal(
          "fetch",
          fetchMock
        );

        const result =
          await fetchLevel5Statistics();

        expect(
          fetchMock
        ).toHaveBeenCalledWith(
          "http://localhost:3001/api/statistics/level-5",
          expect.objectContaining({
            method: "GET",
          })
        );

        expect(
          result.stats.totalUsers
        ).toBe(52);
      }
    );

    it(
      "returns the backend error message",
      async () => {
        vi.stubGlobal(
          "fetch",
          vi.fn().mockResolvedValue({
            ok: false,
            status: 503,

            json: vi.fn()
              .mockResolvedValue({
                error:
                  "Statistics unavailable.",
              }),
          })
        );

        await expect(
          fetchLevel5Statistics()
        ).rejects.toMatchObject({
          message:
            "Statistics unavailable.",

          status: 503,
        });
      }
    );

    it(
      "rejects a malformed response",
      async () => {
        vi.stubGlobal(
          "fetch",
          vi.fn().mockResolvedValue({
            ok: true,
            status: 200,

            json: vi.fn()
              .mockResolvedValue({
                status: "ok",
              }),
          })
        );

        await expect(
          fetchLevel5Statistics()
        ).rejects.toThrow(
          "invalid statistics response"
        );
      }
    );
  }
);
