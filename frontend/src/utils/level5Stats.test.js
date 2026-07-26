import { describe, expect, it } from "vitest";

import {
  formatLevel5UpdatedAt,
  normalizeLevel5Stats,
} from "./level5Stats";

describe("Level 5 statistics helpers", () => {
  it("normalizes a statistics response", () => {
    expect(
      normalizeLevel5Stats({
        stats: {
          totalUsers: "52",
          activeUsers: 41,
          totalInteractions: "180",
          successfulTransactions: 76,
          feedbackCount: 35,
          averageRating: "4.6",
          updatedAt: "2026-07-26T10:00:00.000Z",
        },
      })
    ).toEqual({
      totalUsers: 52,
      activeUsers: 41,
      totalInteractions: 180,
      successfulTransactions: 76,
      feedbackCount: 35,
      averageRating: 4.6,
      updatedAt: "2026-07-26T10:00:00.000Z",
    });
  });

  it("replaces invalid counts with zero", () => {
    const result = normalizeLevel5Stats({
      totalUsers: -10,
      activeUsers: "invalid",
      totalInteractions: null,
    });

    expect(result.totalUsers).toBe(0);
    expect(result.activeUsers).toBe(0);
    expect(result.totalInteractions).toBe(0);
  });

  it("does not allow an average rating above five", () => {
    expect(
      normalizeLevel5Stats({
        averageRating: 7,
      }).averageRating
    ).toBe(5);
  });

  it("formats a valid update timestamp", () => {
    expect(
      formatLevel5UpdatedAt("2026-07-26T10:00:00.000Z")
    ).not.toBe("Not available");
  });

  it("handles an invalid update timestamp", () => {
    expect(
      formatLevel5UpdatedAt("not-a-date")
    ).toBe("Not available");
  });
});
