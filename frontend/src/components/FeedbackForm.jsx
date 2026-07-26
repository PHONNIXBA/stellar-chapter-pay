import {
  useState,
} from "react";

import "./FeedbackForm.css";

import {
  submitFeedback,
} from "../services/api";

import {
  createFeedbackPayload,
  FEEDBACK_CATEGORIES,
} from "../utils/feedback";

import {
  isValidStellarWalletAddress,
} from "../utils/onboarding";

function shortenWallet(
  walletAddress
) {
  if (!walletAddress) {
    return "Wallet not connected";
  }

  if (walletAddress.length <= 24) {
    return walletAddress;
  }

  return (
    `${walletAddress.slice(0, 12)}` +
    "..." +
    `${walletAddress.slice(-10)}`
  );
}

function FeedbackForm({
  walletAddress = "",
  user = null,
  onSubmitted,
}) {
  const [
    rating,
    setRating,
  ] = useState("5");

  const [
    improvementCategory,
    setImprovementCategory,
  ] = useState("onboarding");

  const [
    comment,
    setComment,
  ] = useState("");

  const [
    requestState,
    setRequestState,
  ] = useState("idle");

  const [
    message,
    setMessage,
  ] = useState("");

  const walletIsValid =
    isValidStellarWalletAddress(
      walletAddress
    );

  const profileIsReady =
    walletIsValid &&
    Boolean(user?.id);

  async function handleSubmit(
    event
  ) {
    event.preventDefault();

    setRequestState("submitting");
    setMessage("");

    try {
      if (!user?.id) {
        throw new Error(
          "Complete onboarding before submitting feedback."
        );
      }

      const payload =
        createFeedbackPayload({
          walletAddress,
          rating,
          comment,
          improvementCategory,
        });

      const result =
        await submitFeedback(
          payload
        );

      if (!result?.feedback) {
        throw new Error(
          "The backend did not return the saved feedback."
        );
      }

      setComment("");
      setRequestState("success");

      setMessage(
        "Thank you. Your feedback has been recorded."
      );

      if (
        typeof onSubmitted ===
        "function"
      ) {
        onSubmitted(
          result.feedback
        );
      }
    }
    catch (error) {
      setRequestState("error");

      setMessage(
        error instanceof Error
          ? error.message
          : "Feedback could not be submitted."
      );
    }
  }

  return (
    <section
      className="feedback-card"
      aria-labelledby="feedback-title"
    >
      <div className="feedback-heading">
        <div>
          <span className="feedback-kicker">
            Product feedback
          </span>

          <h2 id="feedback-title">
            Help improve Chapter Pay
          </h2>

          <p>
            Rate your Testnet experience
            and tell us what should be
            improved next.
          </p>
        </div>

        <span
          className={
            profileIsReady
              ? "feedback-profile-status is-ready"
              : "feedback-profile-status"
          }
        >
          {profileIsReady
            ? "Profile ready"
            : "Onboarding required"}
        </span>
      </div>

      <div className="feedback-profile">
        <div>
          <span>User</span>

          <strong>
            {user?.name ||
              "Not registered"}
          </strong>
        </div>

        <div>
          <span>Email</span>

          <strong>
            {user?.email ||
              "Not registered"}
          </strong>
        </div>

        <div>
          <span>Wallet</span>

          <strong title={walletAddress}>
            {shortenWallet(
              walletAddress
            )}
          </strong>
        </div>
      </div>

      <form
        className="feedback-form"
        onSubmit={handleSubmit}
      >
        <label
          className="feedback-field"
          htmlFor="feedback-rating"
        >
          <span>Rating</span>

          <select
            id="feedback-rating"
            value={rating}
            disabled={
              requestState ===
                "submitting" ||
              !profileIsReady
            }
            onChange={(event) => {
              setRating(
                event.target.value
              );

              setRequestState("idle");
              setMessage("");
            }}
          >
            <option value="5">
              5 — Excellent
            </option>

            <option value="4">
              4 — Good
            </option>

            <option value="3">
              3 — Average
            </option>

            <option value="2">
              2 — Difficult
            </option>

            <option value="1">
              1 — Poor
            </option>
          </select>
        </label>

        <label
          className="feedback-field"
          htmlFor="feedback-category"
        >
          <span>
            Improvement category
          </span>

          <select
            id="feedback-category"
            value={
              improvementCategory
            }
            disabled={
              requestState ===
                "submitting" ||
              !profileIsReady
            }
            onChange={(event) => {
              setImprovementCategory(
                event.target.value
              );

              setRequestState("idle");
              setMessage("");
            }}
          >
            {FEEDBACK_CATEGORIES.map(
              (category) => (
                <option
                  key={category.value}
                  value={category.value}
                >
                  {category.label}
                </option>
              )
            )}
          </select>
        </label>

        <label
          className="feedback-field feedback-comment-field"
          htmlFor="feedback-comment"
        >
          <span>
            Feedback
          </span>

          <textarea
            id="feedback-comment"
            value={comment}
            minLength={10}
            maxLength={2000}
            rows={5}
            placeholder="Describe what worked well and what should be improved."
            disabled={
              requestState ===
                "submitting" ||
              !profileIsReady
            }
            onChange={(event) => {
              setComment(
                event.target.value
              );

              setRequestState("idle");
              setMessage("");
            }}
            required
          />

          <small>
            {comment.length}/2000
          </small>
        </label>

        <button
          className="feedback-submit"
          type="submit"
          disabled={
            !profileIsReady ||
            requestState ===
              "submitting"
          }
        >
          {requestState ===
          "submitting"
            ? "Submitting..."
            : "Submit feedback"}
        </button>
      </form>

      {!profileIsReady && (
        <p className="feedback-hint">
          Connect Freighter and complete
          the onboarding profile before
          submitting feedback.
        </p>
      )}

      {message && (
        <p
          className={
            requestState === "success"
              ? "feedback-message is-success"
              : "feedback-message is-error"
          }
          role={
            requestState === "error"
              ? "alert"
              : "status"
          }
          aria-live="polite"
        >
          {message}
        </p>
      )}

      <p className="feedback-privacy">
        Feedback is linked to the Testnet
        wallet for product validation and
        improvement reporting.
      </p>
    </section>
  );
}

export default FeedbackForm;
