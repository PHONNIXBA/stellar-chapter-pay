// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  CACHE_KEYS,
  saveCache,
  loadCache,
  removeCache,
  normalizeChapterStatus,
  canUnlock,
} from "./utils";

describe("cache helpers", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("saves and loads wallet address from cache", () => {
    saveCache(CACHE_KEYS.walletAddress, "GABC123");
    expect(loadCache(CACHE_KEYS.walletAddress)).toBe("GABC123");
  });

  it("saves and removes chapter status from cache", () => {
    saveCache(CACHE_KEYS.chapterStatus, "Unlocked");
    expect(loadCache(CACHE_KEYS.chapterStatus)).toBe("Unlocked");

    removeCache(CACHE_KEYS.chapterStatus);
    expect(loadCache(CACHE_KEYS.chapterStatus)).toBeNull();
  });
});

describe("chapter helpers", () => {
  it("normalizes chapter status correctly", () => {
    expect(normalizeChapterStatus(true)).toBe("Unlocked");
    expect(normalizeChapterStatus(false)).toBe("Locked");
  });

  it("blocks unlock when wallet is not connected", () => {
    expect(
      canUnlock({
        isWalletConnected: false,
        walletAddress: "",
        chapterStatus: "Locked",
      })
    ).toBe(false);
  });

  it("allows unlock only when wallet is connected and chapter is locked", () => {
    expect(
      canUnlock({
        isWalletConnected: true,
        walletAddress: "GABC123",
        chapterStatus: "Locked",
      })
    ).toBe(true);
  });
});