export function normalizeWalletAddress(
  value
) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .toUpperCase();
}

export function isValidStellarWalletAddress(
  value
) {
  return /^G[A-Z2-7]{55}$/.test(
    normalizeWalletAddress(value)
  );
}

export function createOnboardingProfile({
  walletAddress,
}) {
  const normalizedWalletAddress =
    normalizeWalletAddress(
      walletAddress
    );

  if (
    !isValidStellarWalletAddress(
      normalizedWalletAddress
    )
  ) {
    throw new Error(
      "Connect a valid Stellar wallet before registering."
    );
  }

  return {
    walletAddress:
      normalizedWalletAddress,
  };
}
