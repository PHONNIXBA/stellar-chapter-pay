import {
  recordInteraction,
} from "./api";

function normalizeInteraction(
  interaction
) {
  return {
    ...interaction,

    walletAddress:
      typeof interaction.walletAddress ===
      "string"
        ? interaction.walletAddress
            .trim()
            .toUpperCase()
        : "",

    network:
      typeof interaction.network ===
        "string" &&
      interaction.network.trim()
        ? interaction.network
            .trim()
            .toUpperCase()
        : "TESTNET",
  };
}

export async function recordRemoteInteraction(
  interaction
) {
  try {
    return await recordInteraction(
      normalizeInteraction(interaction)
    );
  } catch (error) {
    console.warn(
      "Remote interaction could not be recorded:",
      error
    );

    return null;
  }
}
