import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.mock("./api", () => ({
  recordInteraction: vi.fn(),
}));

import {
  recordInteraction,
} from "./api";

import {
  recordRemoteInteraction,
} from "./activitySync";

describe(
  "remote interaction synchronization",
  () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it(
      "normalizes and forwards a wallet interaction",
      async () => {
        recordInteraction.mockResolvedValue({
          interaction: {
            id: "interaction-1",
          },
        });

        const result =
          await recordRemoteInteraction({
            walletAddress:
              "  gabc123  ",

            action:
              "wallet_connected",

            status: "success",

            network: "testnet",
          });

        expect(
          recordInteraction
        ).toHaveBeenCalledWith({
          walletAddress:
            "GABC123",

          action:
            "wallet_connected",

          status: "success",

          network: "TESTNET",
        });

        expect(result).toEqual({
          interaction: {
            id: "interaction-1",
          },
        });
      }
    );

    it(
      "does not interrupt the dApp when analytics storage fails",
      async () => {
        const warningSpy =
          vi.spyOn(
            console,
            "warn"
          ).mockImplementation(
            () => {}
          );

        recordInteraction.mockRejectedValue(
          new Error(
            "Backend unavailable"
          )
        );

        await expect(
          recordRemoteInteraction({
            walletAddress:
              "GABC123",

            action:
              "chapters_unlocked",

            status: "failed",
          })
        ).resolves.toBeNull();

        expect(
          warningSpy
        ).toHaveBeenCalled();

        warningSpy.mockRestore();
      }
    );
  }
);
