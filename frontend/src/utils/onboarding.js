const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 320;

export function normalizeOnboardingName(
  value
) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeOnboardingEmail(
  value
) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .toLowerCase();
}

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

export function isValidOnboardingName(
  value
) {
  const normalizedName =
    normalizeOnboardingName(value);

  return (
    normalizedName.length >=
      MIN_NAME_LENGTH &&
    normalizedName.length <=
      MAX_NAME_LENGTH
  );
}

export function isValidOnboardingEmail(
  value
) {
  const normalizedEmail =
    normalizeOnboardingEmail(value);

  return (
    normalizedEmail.length > 0 &&
    normalizedEmail.length <=
      MAX_EMAIL_LENGTH &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      normalizedEmail
    )
  );
}

export function isValidStellarWalletAddress(
  value
) {
  return /^G[A-Z2-7]{55}$/.test(
    normalizeWalletAddress(value)
  );
}

export function createOnboardingProfile({
  name,
  email,
  walletAddress,
}) {
  const normalizedProfile = {
    name:
      normalizeOnboardingName(name),

    email:
      normalizeOnboardingEmail(email),

    walletAddress:
      normalizeWalletAddress(
        walletAddress
      ),
  };

  if (
    !isValidOnboardingName(
      normalizedProfile.name
    )
  ) {
    throw new Error(
      "Name must contain between 2 and 120 characters."
    );
  }

  if (
    !isValidOnboardingEmail(
      normalizedProfile.email
    )
  ) {
    throw new Error(
      "Please enter a valid email address."
    );
  }

  if (
    !isValidStellarWalletAddress(
      normalizedProfile.walletAddress
    )
  ) {
    throw new Error(
      "Connect a valid Stellar wallet before registering."
    );
  }

  return normalizedProfile;
}
