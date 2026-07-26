import {
  isValidStellarWalletAddress,
  normalizeWalletAddress,
} from "./onboarding";

const MIN_FEEDBACK_LENGTH = 10;
const MAX_FEEDBACK_LENGTH = 2000;

export const FEEDBACK_CATEGORIES = [
  {
    value: "onboarding",
    label: "Onboarding",
  },
  {
    value: "wallet",
    label: "Wallet connection",
  },
  {
    value: "transaction",
    label: "Transaction flow",
  },
  {
    value: "ui-ux",
    label: "UI and UX",
  },
  {
    value: "performance",
    label: "Performance",
  },
  {
    value: "other",
    label: "Other",
  },
];

const SUPPORTED_CATEGORY_VALUES =
  new Set(
    FEEDBACK_CATEGORIES.map(
      (category) =>
        category.value
    )
  );

export function normalizeFeedbackComment(
  value
) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeFeedbackCategory(
  value
) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .toLowerCase();
}

export function normalizeFeedbackRating(
  value
) {
  const normalizedRating =
    Number(value);

  if (
    !Number.isInteger(
      normalizedRating
    )
  ) {
    return 0;
  }

  return normalizedRating;
}

export function isValidFeedbackComment(
  value
) {
  const normalizedComment =
    normalizeFeedbackComment(
      value
    );

  return (
    normalizedComment.length >=
      MIN_FEEDBACK_LENGTH &&
    normalizedComment.length <=
      MAX_FEEDBACK_LENGTH
  );
}

export function isValidFeedbackCategory(
  value
) {
  return SUPPORTED_CATEGORY_VALUES.has(
    normalizeFeedbackCategory(value)
  );
}

export function isValidFeedbackRating(
  value
) {
  const normalizedRating =
    normalizeFeedbackRating(value);

  return (
    normalizedRating >= 1 &&
    normalizedRating <= 5
  );
}

export function createFeedbackPayload({
  walletAddress,
  rating,
  comment,
  improvementCategory,
}) {
  const normalizedPayload = {
    walletAddress:
      normalizeWalletAddress(
        walletAddress
      ),

    rating:
      normalizeFeedbackRating(
        rating
      ),

    comment:
      normalizeFeedbackComment(
        comment
      ),

    improvementCategory:
      normalizeFeedbackCategory(
        improvementCategory
      ),
  };

  if (
    !isValidStellarWalletAddress(
      normalizedPayload.walletAddress
    )
  ) {
    throw new Error(
      "Connect a valid Stellar wallet before submitting feedback."
    );
  }

  if (
    !isValidFeedbackRating(
      normalizedPayload.rating
    )
  ) {
    throw new Error(
      "Choose a rating from 1 to 5."
    );
  }

  if (
    !isValidFeedbackCategory(
      normalizedPayload
        .improvementCategory
    )
  ) {
    throw new Error(
      "Choose an improvement category."
    );
  }

  if (
    !isValidFeedbackComment(
      normalizedPayload.comment
    )
  ) {
    throw new Error(
      "Feedback must contain between 10 and 2000 characters."
    );
  }

  return normalizedPayload;
}
