// @vitest-environment jsdom

import {
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  CACHE_KEYS,
  canUnlockChapters,
  clearApplicationCache,
  loadCache,
  normalizeSorobanInteger,
  removeCache,
  saveCache,
} from "./cache";

describe("cache helpers", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("saves and loads values", () => {
    saveCache(
      CACHE_KEYS.walletAddress,
      "GABC123"
    );

    expect(
      loadCache(CACHE_KEYS.walletAddress)
    ).toBe("GABC123");
  });

  it("returns a fallback for missing values", () => {
    expect(
      loadCache(
        CACHE_KEYS.tokenBalance,
        "0"
      )
    ).toBe("0");
  });

  it("removes cached values", () => {
    saveCache(
      CACHE_KEYS.txHash,
      "transaction-hash"
    );

    removeCache(CACHE_KEYS.txHash);

    expect(
      loadCache(CACHE_KEYS.txHash)
    ).toBeNull();
  });

  it("clears all application cache keys", () => {
    saveCache(
      CACHE_KEYS.walletAddress,
      "GABC123"
    );

    saveCache(
      CACHE_KEYS.tokenBalance,
      "100"
    );

    clearApplicationCache();

    expect(
      loadCache(CACHE_KEYS.walletAddress)
    ).toBeNull();

    expect(
      loadCache(CACHE_KEYS.tokenBalance)
    ).toBeNull();
  });
});

describe("Soroban value helpers", () => {
  it("normalizes bigint-style values", () => {
    expect(
      normalizeSorobanInteger("25n")
    ).toBe("25");
  });

  it("returns a fallback for empty values", () => {
    expect(
      normalizeSorobanInteger(
        undefined,
        "0"
      )
    ).toBe("0");
  });
});

describe("chapter purchase validation", () => {
  it("allows an affordable chapter purchase", () => {
    expect(
      canUnlockChapters({
        isWalletConnected: true,
        walletAddress: "GABC123",
        quantity: "3",
        tokenBalance: "100",
        pricePerChapter: "5",
      })
    ).toBe(true);
  });

  it("blocks a purchase without a wallet", () => {
    expect(
      canUnlockChapters({
        isWalletConnected: false,
        walletAddress: "",
        quantity: "3",
        tokenBalance: "100",
        pricePerChapter: "5",
      })
    ).toBe(false);
  });

  it("blocks an unaffordable purchase", () => {
    expect(
      canUnlockChapters({
        isWalletConnected: true,
        walletAddress: "GABC123",
        quantity: "3",
        tokenBalance: "10",
        pricePerChapter: "5",
      })
    ).toBe(false);
  });

  it("blocks invalid quantities", () => {
    expect(
      canUnlockChapters({
        isWalletConnected: true,
        walletAddress: "GABC123",
        quantity: "0",
        tokenBalance: "100",
        pricePerChapter: "5",
      })
    ).toBe(false);
  });
});