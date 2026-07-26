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
  normalizeWalletAddress,
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

function walletMatchesUser(
  walletAddress,
  user
) {
  const activeWallet =
    normalizeWalletAddress(
      walletAddress
    );

  const registeredWallet =
    normalizeWalletAddress(
      user?.walletAddress || ""
    );

  return (
    Boolean(activeWallet) &&
    activeWallet ===
      registeredWallet
  );
}

function OnboardingForm({
  walletAddress = "",
  existingUser = null,
  onRegistered,
}) {
  const [
    requestState,
    setRequestState,
  ] = useState("idle");

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const walletIsValid =
    useMemo(
      () =>
        isValidStellarWalletAddress(
          walletAddress
        ),
      [walletAddress]
    );

  const walletIsRegistered =
    walletIsValid &&
    walletMatchesUser(
      walletAddress,
      existingUser
    ) &&
    Boolean(
      existingUser
        ?.onboardingCompleted
    );

  const registrationComplete =
    walletIsRegistered ||
    requestState === "success";

  async function handleSubmit(
    event
  ) {
    event.preventDefault();

    if (
      registrationComplete ||
      requestState ===
        "submitting"
    ) {
      return;
    }

    setRequestState(
      "submitting"
    );

    setErrorMessage("");

    try {
      const profile =
        createOnboardingProfile({
          walletAddress,
        });

      const result =
        await registerUser(
          profile
        );

      if (
        !result?.user
          ?.walletAddress
      ) {
        throw new Error(
          "The backend did not return the registered wallet."
        );
      }

      setRequestState("success");

      if (
        typeof onRegistered ===
        "function"
      ) {
        onRegistered(
          result.user
        );
      }
    }
    catch (error) {
      setRequestState("error");

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The wallet could not be registered."
      );
    }
  }

  return (
    <section
      className={
        registrationComplete
          ? "onboarding-card is-complete"
          : "onboarding-card"
      }
      aria-labelledby="onboarding-title"
    >
      <div className="onboarding-heading">
        <div>
          <span className="onboarding-step">
            Wallet-only onboarding
          </span>

          <h2 id="onboarding-title">
            {registrationComplete
              ? "Testnet wallet registered"
              : "Register your Testnet wallet"}
          </h2>

          <p>
            {registrationComplete
              ? "Your wallet is ready to use Chapter Pay on Stellar Testnet."
              : "Your connected Stellar wallet is the only identity used by Chapter Pay. No personal profile information is collected."}
          </p>
        </div>

        <span
          className={
            registrationComplete
              ? "onboarding-wallet-status is-registered"
              : walletIsValid
                ? "onboarding-wallet-status is-connected"
                : "onboarding-wallet-status"
          }
        >
          {registrationComplete
            ? "Registered"
            : walletIsValid
              ? "Wallet ready"
              : "Connect wallet"}
        </span>
      </div>

      <div className="onboarding-wallet">
        <span>
          {registrationComplete
            ? "Registered wallet"
            : "Wallet identity"}
        </span>

        <strong
          title={walletAddress}
        >
          {shortenWallet(
            walletAddress
          )}
        </strong>
      </div>

      {registrationComplete ? (
        <div
          className="onboarding-complete-summary"
          role="status"
          aria-live="polite"
        >
          <span
            className="onboarding-complete-icon"
            aria-hidden="true"
          >
            ✓
          </span>

          <div>
            <strong>
              Wallet registered successfully
            </strong>

            <p>
              Only your public Testnet
              wallet address is stored.
            </p>
          </div>
        </div>
      ) : (
        <form
          className="onboarding-form"
          onSubmit={handleSubmit}
        >
          <button
            className="onboarding-submit"
            type="submit"
            disabled={
              !walletIsValid ||
              requestState ===
                "submitting"
            }
          >
            {requestState ===
            "submitting"
              ? "Registering wallet..."
              : "Register wallet"}
          </button>
        </form>
      )}

      {!registrationComplete &&
        !walletIsValid && (
          <p className="onboarding-hint">
            Connect a Stellar Testnet
            wallet before registering.
          </p>
        )}

      {!registrationComplete &&
        errorMessage && (
          <p
            className="onboarding-message is-error"
            role="alert"
            aria-live="polite"
          >
            {errorMessage}
          </p>
        )}
    </section>
  );
}

export default OnboardingForm;
