import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getAddress,
  getNetwork,
  isConnected,
  setAllowed,
} from "@stellar/freighter-api";

import "./App.css";

import OnboardingForm from "./components/OnboardingForm";
import FeedbackForm from "./components/FeedbackForm";
import Level5Dashboard from "./components/Level5Dashboard";

import {
  createTransactionExplorerUrl,
  hasCompleteContractConfig,
  loadContractConfig,
  STELLAR_NETWORK,
} from "./contractConfig";

import {
  claimDemoCoins,
  createRpcServer,
  readPricePerChapter,
  readTokenBalance,
  readUnlockedCount,
  unlockChapters,
} from "./services/contract";

import {
  readLocalAnalyticsEvents,
  trackAnalyticsEvent,
} from "./services/analytics";

import {
  fetchUserByWallet,
} from "./services/api";

import {
  recordRemoteInteraction,
} from "./services/activitySync";

import {
  CACHE_KEYS,
  canUnlockChapters,
  clearApplicationCache,
  loadCache,
  saveCache,
} from "./utils/cache";

function shortenMiddle(
  value,
  start = 10,
  end = 8
) {
  if (!value) {
    return "";
  }

  if (
    value.length <=
    start + end + 3
  ) {
    return value;
  }

  return (
    `${value.slice(0, start)}` +
    `...${value.slice(-end)}`
  );
}

function formatTimestamp(value) {
  if (!value) {
    return "Unknown time";
  }

  return new Date(value)
    .toLocaleString();
}

function classifyTransactionError(error) {
  const message = String(
    error?.message || ""
  ).toLowerCase();

  if (
    message.includes("reject") ||
    message.includes("cancel")
  ) {
    return {
      type: "Transaction Rejected",
      message:
        "The transaction was cancelled in Freighter.",
    };
  }

  if (
    message.includes("insufficient") ||
    message.includes("balance")
  ) {
    return {
      type: "Insufficient Coins",
      message:
        "The wallet does not have enough Chapter Coin.",
    };
  }

  if (
    message.includes("already") ||
    message.includes("claimed")
  ) {
    return {
      type: "Already Claimed",
      message:
        "This wallet has already claimed its demo Chapter Coin.",
    };
  }

  if (
    message.includes("timeout")
  ) {
    return {
      type: "Confirmation Timeout",
      message:
        "The transaction was submitted but confirmation took too long.",
    };
  }

  return {
    type: "Transaction Failed",
    message:
      "The Stellar transaction could not be completed.",
  };
}

function App() {
  const rpcServer = useMemo(
    () => createRpcServer(),
    []
  );

  const [
    chapterContractId,
    setChapterContractId,
  ] = useState("");

  const [
    tokenContractId,
    setTokenContractId,
  ] = useState("");

  const [
    configError,
    setConfigError,
  ] = useState("");

  const [
    walletAddress,
    setWalletAddress,
  ] = useState(() =>
    loadCache(
      CACHE_KEYS.walletAddress,
      ""
    )
  );

  const [
    walletStatus,
    setWalletStatus,
  ] = useState(() =>
    loadCache(
      CACHE_KEYS.walletAddress,
      ""
    )
      ? "Cached wallet found. Reconnect for live data."
      : "Wallet not connected."
  );

  const [
    isWalletConnected,
    setIsWalletConnected,
  ] = useState(false);

  const [
    unlockedCount,
    setUnlockedCount,
  ] = useState(() =>
    loadCache(
      CACHE_KEYS.unlockedCount,
      "0"
    )
  );

  const [
    pricePerChapter,
    setPricePerChapter,
  ] = useState("...");

  const [
    tokenBalance,
    setTokenBalance,
  ] = useState(() =>
    loadCache(
      CACHE_KEYS.tokenBalance,
      "0"
    )
  );

  const [
    quantity,
    setQuantity,
  ] = useState("1");

  const [
    txStatus,
    setTxStatus,
  ] = useState(() =>
    loadCache(
      CACHE_KEYS.txHash,
      ""
    )
      ? "Loaded the latest transaction from cache."
      : "No transaction yet."
  );

  const [
    txHash,
    setTxHash,
  ] = useState(() =>
    loadCache(
      CACHE_KEYS.txHash,
      ""
    )
  );

  const [
    errorType,
    setErrorType,
  ] = useState("");

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    isConnecting,
    setIsConnecting,
  ] = useState(false);

  const [
    isRefreshing,
    setIsRefreshing,
  ] = useState(false);

  const [
    isClaiming,
    setIsClaiming,
  ] = useState(false);

  const [
    isUnlocking,
    setIsUnlocking,
  ] = useState(false);

  const [
    activityEvents,
    setActivityEvents,
  ] = useState(() =>
    readLocalAnalyticsEvents()
      .slice(0, 6)
  );

  const [
    onboardingUser,
    setOnboardingUser,
  ] = useState(null);

  const [
    isLoadingOnboardingUser,
    setIsLoadingOnboardingUser,
  ] = useState(false);

  const contractsLoaded =
    hasCompleteContractConfig({
      chapterContractId,
      tokenContractId,
    });

  const quantityNumber =
    Number.isInteger(Number(quantity)) &&
    Number(quantity) > 0
      ? Number(quantity)
      : 0;

  const normalizedPrice =
    pricePerChapter === "..."
      ? 0
      : Number(pricePerChapter) || 0;

  const totalPrice =
    quantityNumber *
    normalizedPrice;

  const unlockedCountNumber =
    Number(unlockedCount) || 0;

  const canPurchase =
    canUnlockChapters({
      isWalletConnected,
      walletAddress,
      quantity,
      tokenBalance,
      pricePerChapter,
    });

  const explorerUrl =
    createTransactionExplorerUrl(
      txHash
    );

  const clearError = useCallback(
    () => {
      setErrorType("");
      setErrorMessage("");
    },
    []
  );

  const showError = useCallback(
    (type, message) => {
      setErrorType(type);
      setErrorMessage(message);
    },
    []
  );

  const recordActivity = useCallback(
    (eventName, properties = {}) => {
      trackAnalyticsEvent(
        eventName,
        properties
      );

      setActivityEvents(
        readLocalAnalyticsEvents()
          .slice(0, 6)
      );
    },
    []
  );

  const loadOnboardingUser =
    useCallback(
      async (address) => {
        if (!address) {
          setOnboardingUser(null);
          setIsLoadingOnboardingUser(false);
          return;
        }

        setOnboardingUser(null);
        setIsLoadingOnboardingUser(true);

        try {
          const result =
            await fetchUserByWallet(
              address
            );

          setOnboardingUser(
            result?.user || null
          );
        } catch (error) {
          if (
            error instanceof Error &&
            error.status === 404
          ) {
            setOnboardingUser(null);
            return;
          }

          console.warn(
            "Onboarding profile could not be loaded:",
            error
          );

          setOnboardingUser(null);
        } finally {
          setIsLoadingOnboardingUser(
            false
          );
        }
      },
      []
    );

  useEffect(() => {
    let isActive = true;

    loadContractConfig()
      .then((config) => {
        if (!isActive) {
          return;
        }

        setChapterContractId(
          config.chapterContractId
        );

        setTokenContractId(
          config.tokenContractId
        );

        setConfigError("");
      })
      .catch((error) => {
        console.error(
          "Contract configuration error:",
          error
        );

        if (!isActive) {
          return;
        }

        setConfigError(
          "Contract addresses could not be loaded."
        );
      });

    return () => {
      isActive = false;
    };
  }, []);

  const refreshAccountData =
    useCallback(
      async (
        address,
        configOverride = {}
      ) => {
        const activeAddress =
          address || walletAddress;

        const activeChapterId =
          configOverride.chapterContractId ||
          chapterContractId;

        const activeTokenId =
          configOverride.tokenContractId ||
          tokenContractId;

        if (!activeAddress) {
          showError(
            "Wallet Not Connected",
            "Connect Freighter before refreshing account data."
          );

          return;
        }

        if (
          !activeChapterId ||
          !activeTokenId
        ) {
          showError(
            "Missing Contract Configuration",
            "The contract addresses have not loaded yet."
          );

          return;
        }

        setIsRefreshing(true);
        clearError();

        try {
          const [
            nextUnlockedCount,
            nextTokenBalance,
            nextPrice,
          ] = await Promise.all([
            readUnlockedCount({
              server: rpcServer,
              contractId:
                activeChapterId,
              walletAddress:
                activeAddress,
            }),

            readTokenBalance({
              server: rpcServer,
              contractId:
                activeTokenId,
              walletAddress:
                activeAddress,
            }),

            readPricePerChapter({
              server: rpcServer,
              contractId:
                activeChapterId,
              walletAddress:
                activeAddress,
            }),
          ]);

          setUnlockedCount(
            nextUnlockedCount
          );

          setTokenBalance(
            nextTokenBalance
          );

          setPricePerChapter(
            nextPrice
          );

          saveCache(
            CACHE_KEYS.unlockedCount,
            nextUnlockedCount
          );

          saveCache(
            CACHE_KEYS.tokenBalance,
            nextTokenBalance
          );

          recordActivity(
            "account_refreshed",
            {
              walletAddress:
                activeAddress,
            }
          );
        } catch (error) {
          console.error(
            "Account refresh error:",
            error
          );

          showError(
            "Refresh Failed",
            "The latest contract state could not be loaded."
          );
        } finally {
          setIsRefreshing(false);
        }
      },
      [
        chapterContractId,
        clearError,
        recordActivity,
        rpcServer,
        showError,
        tokenContractId,
        walletAddress,
      ]
    );

  const handleConnectWallet =
    async () => {
      setIsConnecting(true);
      clearError();

      try {
        setWalletStatus(
          "Checking Freighter..."
        );

        const connectionResult =
          await isConnected();

        if (
          !connectionResult.isConnected
        ) {
          setWalletStatus(
            "Freighter was not detected."
          );

          showError(
            "Wallet Not Found",
            "Install or enable the Freighter browser extension."
          );

          return;
        }

        const networkResult =
          await getNetwork();

        if (
          networkResult.error ||
          networkResult.network !==
            STELLAR_NETWORK.name
        ) {
          setWalletStatus(
            "Freighter is on the wrong network."
          );

          showError(
            "Wrong Network",
            "Switch Freighter to TESTNET and try again."
          );

          return;
        }

        await setAllowed();

        const addressResult =
          await getAddress();

        if (
          addressResult.error ||
          !addressResult.address
        ) {
          throw new Error(
            "Freighter did not return a wallet address."
          );
        }

        const nextWalletAddress =
          addressResult.address;

        let runtimeConfig = {
          chapterContractId,
          tokenContractId,
        };

        if (
          !hasCompleteContractConfig(
            runtimeConfig
          )
        ) {
          runtimeConfig =
            await loadContractConfig();

          setChapterContractId(
            runtimeConfig.chapterContractId
          );

          setTokenContractId(
            runtimeConfig.tokenContractId
          );
        }

        setWalletAddress(
          nextWalletAddress
        );

        setIsWalletConnected(true);

        setWalletStatus(
          "Wallet connected on Stellar Testnet."
        );

        saveCache(
          CACHE_KEYS.walletAddress,
          nextWalletAddress
        );

        void loadOnboardingUser(
          nextWalletAddress
        );

        recordActivity(
          "wallet_connected",
          {
            walletAddress:
              nextWalletAddress,
          }
        );

        void recordRemoteInteraction({
          walletAddress:
            nextWalletAddress,

          action:
            "wallet_connected",

          status: "success",

          network:
            STELLAR_NETWORK.name,
        });

        await refreshAccountData(
          nextWalletAddress,
          runtimeConfig
        );
      } catch (error) {
        console.error(
          "Wallet connection error:",
          error
        );

        setWalletStatus(
          "Wallet connection failed."
        );

        showError(
          "Connection Failed",
          "Freighter could not be connected."
        );
      } finally {
        setIsConnecting(false);
      }
    };

  const handleDisconnectWallet =
    () => {
      clearApplicationCache();

      setWalletAddress("");
      setWalletStatus(
        "Wallet disconnected."
      );

      setIsWalletConnected(false);
      setOnboardingUser(null);
      setIsLoadingOnboardingUser(false);
      setUnlockedCount("0");
      setPricePerChapter("...");
      setTokenBalance("0");
      setQuantity("1");
      setTxHash("");
      setTxStatus(
        "No transaction yet."
      );

      clearError();

      recordActivity(
        "wallet_disconnected"
      );
    };

  const handleClaimCoins =
    async () => {
      if (
        !isWalletConnected ||
        !walletAddress
      ) {
        showError(
          "Wallet Not Connected",
          "Connect Freighter before claiming demo Coins."
        );

        return;
      }

      if (!tokenContractId) {
        showError(
          "Missing Contract Configuration",
          "The Chapter Token contract address is unavailable."
        );

        return;
      }

      setIsClaiming(true);
      clearError();

      setTxStatus(
        "Preparing demo Coin claim..."
      );

      let submittedTransactionHash = "";

      try {
        await claimDemoCoins({
          server: rpcServer,
          contractId:
            tokenContractId,
          walletAddress,
          onSubmitted:
            (transactionHash) => {
              submittedTransactionHash =
                transactionHash;

              setTxHash(
                transactionHash
              );

              saveCache(
                CACHE_KEYS.txHash,
                transactionHash
              );

              setTxStatus(
                "Transaction submitted. Waiting for confirmation..."
              );

              void recordRemoteInteraction({
                walletAddress,

                action:
                  "demo_coins_claimed",

                contractFunction:
                  "faucet",

                status: "pending",

                txHash:
                  transactionHash,

                network:
                  STELLAR_NETWORK.name,
              });
            },
        });

        setTxStatus(
          "Demo Coins claimed successfully."
        );

        recordActivity(
          "demo_coins_claimed",
          { walletAddress }
        );

        void recordRemoteInteraction({
          walletAddress,

          action:
            "demo_coins_claimed",

          contractFunction:
            "faucet",

          status: "success",

          txHash:
            submittedTransactionHash ||
            undefined,

          network:
            STELLAR_NETWORK.name,
        });

        await refreshAccountData(
          walletAddress
        );
      } catch (error) {
        console.error(
          "Demo Coin claim error:",
          error
        );

        const classifiedError =
          classifyTransactionError(
            error
          );

        showError(
          classifiedError.type,
          classifiedError.message
        );

        setTxStatus(
          "Demo Coin claim failed."
        );

        void recordRemoteInteraction({
          walletAddress,

          action:
            "demo_coins_claimed",

          contractFunction:
            "faucet",

          status: "failed",

          txHash:
            submittedTransactionHash ||
            undefined,

          network:
            STELLAR_NETWORK.name,

          metadata: {
            errorType:
              classifiedError.type,
          },
        });
      } finally {
        setIsClaiming(false);
      }
    };

  const handleUnlockChapters =
    async (event) => {
      event.preventDefault();

      if (!canPurchase) {
        showError(
          "Purchase Not Available",
          "Check the wallet connection, quantity, price, and Chapter Coin balance."
        );

        return;
      }

      if (!chapterContractId) {
        showError(
          "Missing Contract Configuration",
          "The Chapter Payment contract address is unavailable."
        );

        return;
      }

      setIsUnlocking(true);
      clearError();

      setTxStatus(
        "Preparing chapter purchase..."
      );

      let submittedTransactionHash = "";

      try {
        await unlockChapters({
          server: rpcServer,
          contractId:
            chapterContractId,
          walletAddress,
          quantity:
            quantityNumber,
          onSubmitted:
            (transactionHash) => {
              submittedTransactionHash =
                transactionHash;

              setTxHash(
                transactionHash
              );

              saveCache(
                CACHE_KEYS.txHash,
                transactionHash
              );

              setTxStatus(
                "Transaction submitted. Waiting for confirmation..."
              );

              void recordRemoteInteraction({
                walletAddress,

                action:
                  "chapters_unlocked",

                contractFunction:
                  "unlock_with_payment",

                status: "pending",

                txHash:
                  transactionHash,

                network:
                  STELLAR_NETWORK.name,

                metadata: {
                  quantity:
                    quantityNumber,

                  totalPrice,
                },
              });
            },
        });

        setTxStatus(
          `${quantityNumber} chapter(s) unlocked successfully.`
        );

        recordActivity(
          "chapters_unlocked",
          {
            walletAddress,
            quantity:
              quantityNumber,
            totalPrice,
          }
        );

        void recordRemoteInteraction({
          walletAddress,

          action:
            "chapters_unlocked",

          contractFunction:
            "unlock_with_payment",

          status: "success",

          txHash:
            submittedTransactionHash ||
            undefined,

          network:
            STELLAR_NETWORK.name,

          metadata: {
            quantity:
              quantityNumber,

            totalPrice,
          },
        });

        await refreshAccountData(
          walletAddress
        );
      } catch (error) {
        console.error(
          "Chapter purchase error:",
          error
        );

        const classifiedError =
          classifyTransactionError(
            error
          );

        showError(
          classifiedError.type,
          classifiedError.message
        );

        setTxStatus(
          "Chapter purchase failed."
        );

        void recordRemoteInteraction({
          walletAddress,

          action:
            "chapters_unlocked",

          contractFunction:
            "unlock_with_payment",

          status: "failed",

          txHash:
            submittedTransactionHash ||
            undefined,

          network:
            STELLAR_NETWORK.name,

          metadata: {
            quantity:
              quantityNumber,

            totalPrice,

            errorType:
              classifiedError.type,
          },
        });
      } finally {
        setIsUnlocking(false);
      }
    };

  const copyText =
    async (value, label) => {
      if (!value) {
        return;
      }

      try {
        await navigator.clipboard
          .writeText(value);

        setTxStatus(
          `${label} copied.`
        );
      } catch {
        showError(
          "Copy Failed",
          `${label} could not be copied.`
        );
      }
    };

  return (
    <main className="app-page">
      <div className="app-shell">
        <header className="topbar">
          <div className="brand-block">
            <div className="brand-mark">
              SC
            </div>

            <div>
              <p className="brand-name">
                Stellar Chapter Pay
              </p>

              <p className="brand-subtitle">
                Chapter access powered by Soroban
              </p>
            </div>
          </div>

          <div className="topbar-actions">
            <span className="network-pill">
              <span className="network-dot" />
              Stellar Testnet
            </span>

            {isWalletConnected ? (
              <button
                type="button"
                className="button button-secondary"
                onClick={
                  handleDisconnectWallet
                }
              >
                Disconnect
              </button>
            ) : (
              <button
                type="button"
                className="button button-primary"
                onClick={
                  handleConnectWallet
                }
                disabled={isConnecting}
              >
                {isConnecting
                  ? "Connecting..."
                  : "Connect Freighter"}
              </button>
            )}
          </div>
        </header>

        <section className="hero-section">
          <div className="hero-copy">
            <p className="eyebrow">
              PRODUCTION-READY STELLAR DAPP
            </p>

            <h1>
              Unlock multiple digital
              chapters in one transaction.
            </h1>

            <p className="hero-description">
              Claim Chapter Coin, select
              the number of chapters, and
              process one transparent
              Soroban payment on Stellar
              Testnet.
            </p>

            <div className="hero-badges">
              <span className="status-pill status-live">
                Contract integration
              </span>

              <span className="status-pill">
                Inter-contract payment
              </span>

              <span className="status-pill">
                Responsive dashboard
              </span>
            </div>
          </div>

          <div className="hero-summary">
            <p className="summary-label">
              Current access
            </p>

            <p className="summary-value">
              {unlockedCountNumber}
            </p>

            <p className="summary-unit">
              chapters unlocked
            </p>

            <div className="summary-divider" />

            <p className="summary-caption">
              {isWalletConnected
                ? "Live wallet data"
                : "Connect a wallet for live data"}
            </p>
          </div>
        </section>

        {(errorMessage ||
          configError) && (
          <section
            className="error-banner"
            role="alert"
          >
            <div className="error-icon">
              !
            </div>

            <div>
              <p className="error-title">
                {errorType ||
                  "Configuration Error"}
              </p>

              <p className="error-text">
                {errorMessage ||
                  configError}
              </p>
            </div>

            <button
              type="button"
              className="error-close"
              aria-label="Close error"
              onClick={() => {
                clearError();
                setConfigError("");
              }}
            >
              ×
            </button>
          </section>
        )}

        <section className="onboarding-wrapper">
          {isLoadingOnboardingUser ? (
            <div
              className="onboarding-loading"
              role="status"
              aria-live="polite"
            >
              Loading the profile linked
              to this Stellar wallet...
            </div>
          ) : (
            <OnboardingForm
              key={
                `${walletAddress}:` +
                `${
                  onboardingUser?.id ||
                  "new"
                }`
              }
              walletAddress={
                isWalletConnected
                  ? walletAddress
                  : ""
              }
              existingUser={
                onboardingUser
              }
              onRegistered={(user) => {
                setOnboardingUser(user);

                recordActivity(
                  "profile_registered",
                  {
                    walletAddress:
                      user.walletAddress,
                  }
                );

                void recordRemoteInteraction({
                  walletAddress:
                    user.walletAddress,

                  action:
                    "wallet_connected",

                  status: "success",

                  network:
                    STELLAR_NETWORK.name,

                  metadata: {
                    source:
                      "profile_registration",
                  },
                });
              }}
            />
          )}
        </section>

        <section className="metrics-grid">
          <article className="metric-card">
            <p className="metric-label">
              Chapter Coin balance
            </p>

            <p className="metric-value">
              {tokenBalance}
            </p>

            <p className="metric-caption">
              Available for purchases
            </p>
          </article>

          <article className="metric-card">
            <p className="metric-label">
              Price per chapter
            </p>

            <p className="metric-value">
              {pricePerChapter}
            </p>

            <p className="metric-caption">
              Chapter Coin
            </p>
          </article>

          <article className="metric-card">
            <p className="metric-label">
              Selected quantity
            </p>

            <p className="metric-value">
              {quantityNumber}
            </p>

            <p className="metric-caption">
              Chapters in this payment
            </p>
          </article>

          <article className="metric-card">
            <p className="metric-label">
              Total payment
            </p>

            <p className="metric-value">
              {totalPrice}
            </p>

            <p className="metric-caption">
              Chapter Coin
            </p>
          </article>
        </section>

        <section className="workspace-grid">
          <article className="panel action-panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">
                  ACTION WORKSPACE
                </p>

                <h2>
                  Purchase chapter access
                </h2>

                <p className="panel-description">
                  All selected chapters are
                  processed through one
                  contract transaction.
                </p>
              </div>

              <span
                className={
                  contractsLoaded
                    ? "panel-state state-ready"
                    : "panel-state"
                }
              >
                {contractsLoaded
                  ? "Contracts ready"
                  : "Loading contracts"}
              </span>
            </div>

            <form
              className="purchase-form"
              onSubmit={
                handleUnlockChapters
              }
            >
              <label
                className="field-label"
                htmlFor="chapter-quantity"
              >
                Number of chapters
              </label>

              <input
                id="chapter-quantity"
                className="quantity-input"
                type="number"
                min="1"
                max="100"
                step="1"
                value={quantity}
                onChange={(event) => {
                  setQuantity(
                    event.target.value
                  );
                }}
              />

              <div className="price-summary">
                <div>
                  <p className="price-label">
                    Estimated total
                  </p>

                  <p className="price-value">
                    {totalPrice} Coins
                  </p>
                </div>

                <p className="price-formula">
                  {quantityNumber} ×{" "}
                  {normalizedPrice}
                </p>
              </div>

              <div className="action-buttons">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={
                    handleClaimCoins
                  }
                  disabled={
                    isClaiming ||
                    !isWalletConnected ||
                    !tokenContractId
                  }
                >
                  {isClaiming
                    ? "Claiming..."
                    : "Claim Demo Coins"}
                </button>

                <button
                  type="submit"
                  className="button button-primary"
                  disabled={
                    isUnlocking ||
                    !canPurchase
                  }
                >
                  {isUnlocking
                    ? "Processing..."
                    : "Unlock Chapters"}
                </button>
              </div>

              {!canPurchase && (
                <p className="form-hint">
                  Connect Freighter and make
                  sure the wallet has enough
                  Chapter Coin.
                </p>
              )}
            </form>
          </article>

          <article className="panel transaction-panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">
                  TRANSACTION MONITOR
                </p>

                <h2>
                  Latest transaction
                </h2>
              </div>

              <span className="panel-state">
                Testnet
              </span>
            </div>

            <div className="status-box">
              <p className="detail-label">
                Status
              </p>

              <p className="status-message">
                {txStatus}
              </p>
            </div>

            <div className="detail-box">
              <p className="detail-label">
                Transaction hash
              </p>

              <p className="detail-value">
                {txHash
                  ? shortenMiddle(
                      txHash,
                      16,
                      14
                    )
                  : "No transaction recorded"}
              </p>
            </div>

            <div className="action-buttons">
              <button
                type="button"
                className="button button-secondary"
                disabled={!txHash}
                onClick={() =>
                  copyText(
                    txHash,
                    "Transaction hash"
                  )
                }
              >
                Copy hash
              </button>

              {explorerUrl && (
                <a
                  className="button button-link"
                  href={explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  View on explorer
                </a>
              )}
            </div>
          </article>
        </section>

        <section className="lower-grid">
          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">
                  WALLET SESSION
                </p>

                <h2>
                  Freighter wallet
                </h2>
              </div>

              <span
                className={
                  isWalletConnected
                    ? "panel-state state-ready"
                    : "panel-state"
                }
              >
                {isWalletConnected
                  ? "Connected"
                  : "Disconnected"}
              </span>
            </div>

            <div className="detail-list">
              <div className="detail-row">
                <span>Status</span>

                <strong>
                  {walletStatus}
                </strong>
              </div>

              <div className="detail-row">
                <span>Address</span>

                <strong>
                  {walletAddress
                    ? shortenMiddle(
                        walletAddress
                      )
                    : "Not connected"}
                </strong>
              </div>

              <div className="detail-row">
                <span>Network</span>

                <strong>
                  {STELLAR_NETWORK.name}
                </strong>
              </div>
            </div>

            <div className="action-buttons">
              <button
                type="button"
                className="button button-secondary"
                disabled={!walletAddress}
                onClick={() =>
                  copyText(
                    walletAddress,
                    "Wallet address"
                  )
                }
              >
                Copy address
              </button>

              <button
                type="button"
                className="button button-secondary"
                disabled={
                  isRefreshing ||
                  !walletAddress ||
                  !contractsLoaded
                }
                onClick={() =>
                  refreshAccountData(
                    walletAddress
                  )
                }
              >
                {isRefreshing
                  ? "Refreshing..."
                  : "Refresh data"}
              </button>
            </div>
          </article>

          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">
                  CONTRACT RUNTIME
                </p>

                <h2>
                  Soroban configuration
                </h2>
              </div>

              <span
                className={
                  contractsLoaded
                    ? "panel-state state-ready"
                    : "panel-state"
                }
              >
                {contractsLoaded
                  ? "Available"
                  : "Unavailable"}
              </span>
            </div>

            <div className="contract-list">
              <div className="contract-item">
                <p className="detail-label">
                  Chapter Payment
                </p>

                <p className="contract-address">
                  {chapterContractId
                    ? shortenMiddle(
                        chapterContractId,
                        14,
                        12
                      )
                    : "Not loaded"}
                </p>
              </div>

              <div className="contract-item">
                <p className="detail-label">
                  Chapter Token
                </p>

                <p className="contract-address">
                  {tokenContractId
                    ? shortenMiddle(
                        tokenContractId,
                        14,
                        12
                      )
                    : "Not loaded"}
                </p>
              </div>
            </div>
          </article>

          <article className="panel activity-panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">
                  PRODUCT ANALYTICS
                </p>

                <h2>
                  Recent activity
                </h2>
              </div>

              <span className="panel-state">
                {activityEvents.length} events
              </span>
            </div>

            {activityEvents.length === 0 ? (
              <p className="empty-state">
                Wallet and contract activity
                will appear here.
              </p>
            ) : (
              <div className="activity-list">
                {activityEvents.map(
                  (activity) => (
                    <div
                      className="activity-item"
                      key={activity.id}
                    >
                      <span className="activity-dot" />

                      <div>
                        <p className="activity-name">
                          {activity.name
                            .replaceAll(
                              "_",
                              " "
                            )}
                        </p>

                        <p className="activity-time">
                          {formatTimestamp(
                            activity.timestamp
                          )}
                        </p>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </article>
        </section>

        <section className="level5-wrapper">
          <Level5Dashboard />
        </section>

        <section className="feedback-wrapper">
          <FeedbackForm
            key={
              `${walletAddress}:` +
              `${
                onboardingUser?.id ||
                "unregistered"
              }`
            }
            walletAddress={
              isWalletConnected
                ? walletAddress
                : ""
            }
            user={onboardingUser}
            onSubmitted={(feedback) => {
              const feedbackWallet =
                feedback.walletAddress ||
                walletAddress;

              recordActivity(
                "feedback_submitted",
                {
                  walletAddress:
                    feedbackWallet,

                  rating:
                    feedback.rating,

                  improvementCategory:
                    feedback
                      .improvementCategory,
                }
              );

              void recordRemoteInteraction({
                walletAddress:
                  feedbackWallet,

                action:
                  "feedback_submitted",

                status: "success",

                network:
                  STELLAR_NETWORK.name,

                metadata: {
                  feedbackId:
                    feedback.id,

                  rating:
                    feedback.rating,

                  improvementCategory:
                    feedback
                      .improvementCategory,
                },
              });
            }}
          />
        </section>

        <footer className="app-footer">
          <p>
            Stellar Chapter Pay · Soroban
            Testnet MVP
          </p>

          <p>
            Payments are processed through
            Chapter Payment and Chapter
            Token contracts.
          </p>
        </footer>
      </div>
    </main>
  );
}

export default App;
