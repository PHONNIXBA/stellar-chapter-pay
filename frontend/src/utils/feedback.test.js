import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createFeedbackPayload,
  FEEDBACK_CATEGORIES,
  isValidFeedbackComment,
  isValidFeedbackRating,
  normalizeFeedbackComment,
} from "./feedback";

const TEST_WALLET =
  `G${"F".repeat(55)}`;

describe(
  "feedback helpers",
  () => {
    it(
      "provides supported improvement categories",
      () => {
        expect(
          FEEDBACK_CATEGORIES
        ).toHaveLength(6);

        expect(
          FEEDBACK_CATEGORIES.some(
            (category) =>
              category.value ===
              "transaction"
          )
        ).toBe(true);
      }
    );

    it(
      "normalizes feedback text",
      () => {
        expect(
          normalizeFeedbackComment(
            "  The   payment flow was clear.  "
          )
        ).toBe(
          "The payment flow was clear."
        );
      }
    );

    it(
      "validates ratings from 1 to 5",
      () => {
        expect(
          isValidFeedbackRating(5)
        ).toBe(true);

        expect(
          isValidFeedbackRating(0)
        ).toBe(false);

        expect(
          isValidFeedbackRating(6)
        ).toBe(false);
      }
    );

    it(
      "requires meaningful feedback text",
      () => {
        expect(
          isValidFeedbackComment(
            "The transaction flow was easy."
          )
        ).toBe(true);

        expect(
          isValidFeedbackComment(
            "Too short"
          )
        ).toBe(false);
      }
    );

    it(
      "creates a normalized feedback payload",
      () => {
        expect(
          createFeedbackPayload({
            walletAddress:
              TEST_WALLET.toLowerCase(),

            rating: "5",

            comment:
              "  The   onboarding was easy to understand. ",

            improvementCategory:
              "ONBOARDING",
          })
        ).toEqual({
          walletAddress:
            TEST_WALLET,

          rating: 5,

          comment:
            "The onboarding was easy to understand.",

          improvementCategory:
            "onboarding",
        });
      }
    );

    it(
      "rejects an unsupported category",
      () => {
        expect(() =>
          createFeedbackPayload({
            walletAddress:
              TEST_WALLET,

            rating: 4,

            comment:
              "The application worked correctly.",

            improvementCategory:
              "unsupported",
          })
        ).toThrow(
          "Choose an improvement category."
        );
      }
    );

    it(
      "rejects feedback without a valid wallet",
      () => {
        expect(() =>
          createFeedbackPayload({
            walletAddress: "",

            rating: 4,

            comment:
              "The application worked correctly.",

            improvementCategory:
              "ui-ux",
          })
        ).toThrow(
          "Connect a valid Stellar wallet"
        );
      }
    );
  }
);
