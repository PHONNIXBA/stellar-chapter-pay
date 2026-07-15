export const CACHE_KEYS = Object.freeze({
  walletAddress: "stellar_chapter_wallet_address",
  unlockedCount: "stellar_unlocked_count",
  txHash: "stellar_chapter_tx_hash",
  tokenBalance: "stellar_chapter_token_balance",
  analyticsEvents: "stellar_chapter_analytics_events",
});

function resolveStorage(storage) {
  if (storage) {
    return storage;
  }

  if (typeof window !== "undefined") {
    return window.localStorage;
  }

  return null;
}

export function saveCache(key, value, storage) {
  const activeStorage = resolveStorage(storage);

  if (!activeStorage) {
    return;
  }

  activeStorage.setItem(key, String(value));
}

export function loadCache(key, fallback = null, storage) {
  const activeStorage = resolveStorage(storage);

  if (!activeStorage) {
    return fallback;
  }

  return activeStorage.getItem(key) ?? fallback;
}

export function removeCache(key, storage) {
  const activeStorage = resolveStorage(storage);

  if (!activeStorage) {
    return;
  }

  activeStorage.removeItem(key);
}

export function clearApplicationCache(storage) {
  Object.values(CACHE_KEYS).forEach((key) => {
    removeCache(key, storage);
  });
}

export function normalizeSorobanInteger(
  value,
  fallback = "0"
) {
  if (value === null || value === undefined) {
    return fallback;
  }

  const normalized = String(value).replace(/n$/, "");

  return normalized || fallback;
}

export function canUnlockChapters({
  isWalletConnected,
  walletAddress,
  quantity,
  tokenBalance,
  pricePerChapter,
}) {
  if (!isWalletConnected || !walletAddress) {
    return false;
  }

  const normalizedQuantity = Number(quantity);
  const normalizedBalance = Number(
    normalizeSorobanInteger(tokenBalance)
  );
  const normalizedPrice = Number(
    normalizeSorobanInteger(pricePerChapter)
  );

  if (
    !Number.isInteger(normalizedQuantity) ||
    normalizedQuantity <= 0
  ) {
    return false;
  }

  if (
    !Number.isFinite(normalizedBalance) ||
    !Number.isFinite(normalizedPrice) ||
    normalizedPrice <= 0
  ) {
    return false;
  }

  return (
    normalizedBalance >=
    normalizedQuantity * normalizedPrice
  );
}