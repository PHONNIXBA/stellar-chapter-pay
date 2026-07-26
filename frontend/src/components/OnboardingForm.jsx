import {
  useMemo,
  useState,
} from "react";

import "./OnboardingForm.css";

import {
  registerUser,
} from "../services/api";

import {
  createOnboardingProfile,
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

function getInitialValue(
  user,
  fieldName
) {
  const value =
    user?.[fieldName];

  return typeof value === "string"
    ? value
    : "";
}

function OnboardingForm({
  walletAddress = "",
  existingUser = null,
  onRegistered,
}) {
  const [name, setName] =
    useState(() =>
      getInitialValue(
        existingUser,
        "name"
      )
    );

  const [email, setEmail] =
    useState(() =>
      getInitialValue(
        existingUser,
        "email"
      )
    );

  const [requestState, setRequestState] =
    useState("idle");

  const [message, setMessage] =
    useState("");

  const walletIsValid =
    useMemo(
      () =>
        isValidStellarWalletAddress(
          walletAddress
        ),
      [walletAddress]
    );

  const profileIsRegistered =
    requestState === "success" ||
    Boolean(existingUser?.id);

  async function handleSubmit(event) {
    event.preventDefault();

    setRequestState("submitting");
    setMessage("");

    try {
      const profile =
        createOnboardingProfile({
          name,
          email,
          walletAddress,
        });

      const result =
        await registerUser(profile);

      if (!result?.user) {
        throw new Error(
          "The backend did not return a user profile."
        );
      }

      setName(result.user.name);
      setEmail(result.user.email);

      setRequestState("success");

      setMessage(
        profileIsRegistered
          ? "Your profile has been updated."
          : "Onboarding completed successfully."
      );

      if (
        typeof onRegistered ===
        "function"
      ) {
        onRegistered(result.user);
      }
    }
    catch (error) {
      setRequestState("error");

      setMessage(
        error instanceof Error
          ? error.message
          : "The profile could not be saved."
      );
    }
  }

  const buttonLabel =
    requestState === "submitting"
      ? "Saving profile..."
      : profileIsRegistered
        ? "Update profile"
        : "Complete onboarding";

  return (
    <section
      className="onboarding-card"
      aria-labelledby="onboarding-title"
    >
      <div className="onboarding-heading">
        <div>
          <span className="onboarding-step">
            Level 5 onboarding
          </span>

          <h2 id="onboarding-title">
            Register your Testnet profile
          </h2>

          <p>
            Link your name and email to the
            connected Stellar wallet before
            using the chapter payment flow.
          </p>
        </div>

        <span
          className={
            walletIsValid
              ? "onboarding-wallet-status is-connected"
              : "onboarding-wallet-status"
          }
        >
          {walletIsValid
            ? "Wallet ready"
            : "Connect wallet"}
        </span>
      </div>

      <div className="onboarding-wallet">
        <span>Connected wallet</span>

        <strong title={walletAddress}>
          {shortenWallet(walletAddress)}
        </strong>
      </div>

      <form
        className="onboarding-form"
        onSubmit={handleSubmit}
      >
        <label
          className="onboarding-field"
          htmlFor="onboarding-name"
        >
          <span>Name</span>

          <input
            id="onboarding-name"
            name="name"
            type="text"
            value={name}
            minLength={2}
            maxLength={120}
            autoComplete="name"
            placeholder="Enter your name"
            disabled={
              requestState ===
              "submitting"
            }
            onChange={(event) => {
              setName(
                event.target.value
              );

              if (
                requestState !==
                "idle"
              ) {
                setRequestState(
                  "idle"
                );

                setMessage("");
              }
            }}
            required
          />
        </label>

        <label
          className="onboarding-field"
          htmlFor="onboarding-email"
        >
          <span>Email</span>

          <input
            id="onboarding-email"
            name="email"
            type="email"
            value={email}
            maxLength={320}
            autoComplete="email"
            placeholder="name@example.com"
            disabled={
              requestState ===
              "submitting"
            }
            onChange={(event) => {
              setEmail(
                event.target.value
              );

              if (
                requestState !==
                "idle"
              ) {
                setRequestState(
                  "idle"
                );

                setMessage("");
              }
            }}
            required
          />
        </label>

        <button
          className="onboarding-submit"
          type="submit"
          disabled={
            !walletIsValid ||
            requestState ===
              "submitting"
          }
        >
          {buttonLabel}
        </button>
      </form>

      {!walletIsValid && (
        <p className="onboarding-hint">
          Connect Freighter on Stellar
          Testnet before submitting this
          form.
        </p>
      )}

      {message && (
        <p
          className={
            requestState === "success"
              ? "onboarding-message is-success"
              : "onboarding-message is-error"
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

      <p className="onboarding-privacy">
        Your profile is used only for
        Level 5 user validation, activity
        tracking, feedback and product
        improvement.
      </p>
    </section>
  );
}

export default OnboardingForm;
