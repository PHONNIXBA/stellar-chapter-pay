function toNonNegativeInteger(value) {
  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }

  return Math.floor(number);
}

function toAverageRating(value) {
  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }

  return Math.min(number, 5);
}

export function normalizeLevel5Stats(payload = {}) {
  const source = payload?.stats || payload || {};

  return {
    totalUsers: toNonNegativeInteger(source.totalUsers),
    activeUsers: toNonNegativeInteger(source.activeUsers),
    totalInteractions: toNonNegativeInteger(source.totalInteractions),
    successfulTransactions: toNonNegativeInteger(
      source.successfulTransactions
    ),
    feedbackCount: toNonNegativeInteger(source.feedbackCount),
    averageRating: toAverageRating(source.averageRating),
    updatedAt:
      typeof source.updatedAt === "string"
        ? source.updatedAt
        : "",
  };
}

export function formatLevel5UpdatedAt(value) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleString();
}
