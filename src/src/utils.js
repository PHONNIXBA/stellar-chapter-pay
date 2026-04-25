export const CACHE_KEYS = {
  walletAddress: "stellar_chapter_wallet_address",
  chapterStatus: "stellar_chapter_status",
  txHash: "stellar_chapter_tx_hash",
};

export function saveCache(key, value) {
  localStorage.setItem(key, value);
}

export function loadCache(key) {
  return localStorage.getItem(key);
}

export function removeCache(key) {
  localStorage.removeItem(key);
}

export function normalizeChapterStatus(value) {
  return value ? "Unlocked" : "Locked";
}

export function canUnlock({ isWalletConnected, walletAddress, chapterStatus }) {
  if (!isWalletConnected || !walletAddress) return false;
  if (chapterStatus === "Unlocked") return false;
  return true;
}