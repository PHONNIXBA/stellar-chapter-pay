import { useEffect, useMemo, useState } from "react";
import {
  getAddress,
  getNetwork,
  isConnected,
  setAllowed,
  signTransaction,
} from "@stellar/freighter-api";
import * as StellarSDK from "@stellar/stellar-sdk";

const CONTRACT_ID =
  "CA4OE7GBLEUISESUKWDOLTX4B25CNFWZMGT4LIMFOWOYW5L3MD7WV6RI";

const RPC_URL = "https://soroban-testnet.stellar.org:443";

const CACHE_KEYS = {
  walletAddress: "stellar_chapter_wallet_address",
  chapterStatus: "stellar_chapter_status",
  txHash: "stellar_chapter_tx_hash",
};

function shortenMiddle(value, start = 8, end = 6) {
  if (!value || value.length <= start + end + 3) return value;
  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

function App() {
  const rpcServer = useMemo(() => new StellarSDK.rpc.Server(RPC_URL), []);

  const [walletAddress, setWalletAddress] = useState("");
  const [walletStatus, setWalletStatus] = useState("Wallet not connected");
  const [isWalletConnected, setIsWalletConnected] = useState(false);

  const [chapterStatus, setChapterStatus] = useState("Unknown");
  const [txStatus, setTxStatus] = useState("No transaction yet.");
  const [txHash, setTxHash] = useState("");

  const [errorMessage, setErrorMessage] = useState("");
  const [errorType, setErrorType] = useState("");

  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);

  const clearMessages = () => {
    setErrorMessage("");
    setErrorType("");
  };

  const showError = (type, message) => {
    setErrorType(type);
    setErrorMessage(message);
  };

  const saveCache = (key, value) => {
    localStorage.setItem(key, value);
  };

  const removeCache = (key) => {
    localStorage.removeItem(key);
  };

  const loadCachedData = () => {
    const cachedWallet = localStorage.getItem(CACHE_KEYS.walletAddress);
    const cachedChapterStatus = localStorage.getItem(CACHE_KEYS.chapterStatus);
    const cachedTxHash = localStorage.getItem(CACHE_KEYS.txHash);

    if (cachedWallet) {
      setWalletAddress(cachedWallet);
      setWalletStatus("Cached wallet found. Reconnect to refresh live data.");
    }

    if (cachedChapterStatus) {
      setChapterStatus(cachedChapterStatus);
    }

    if (cachedTxHash) {
      setTxHash(cachedTxHash);
      setTxStatus("Loaded last transaction from cache.");
    }
  };

  const handleConnectWallet = async () => {
    try {
      clearMessages();
      setIsConnecting(true);
      setWalletStatus("Connecting wallet...");

      const connected = await isConnected();

      if (!connected.isConnected) {
        setWalletStatus("Wallet not found.");
        showError(
          "Wallet Not Found",
          "Freighter wallet is not installed in this browser."
        );
        return;
      }

      const networkResult = await getNetwork();

      if (networkResult.error) {
        setWalletStatus("Could not detect wallet network.");
        showError(
          "Network Error",
          "Could not read Freighter network. Please open Freighter and try again."
        );
        return;
      }

      if (networkResult.network !== "TESTNET") {
        setWalletStatus("Wrong network.");
        showError(
          "Wrong Network",
          "Please switch Freighter wallet to TESTNET."
        );
        return;
      }

      await setAllowed();

      const addressResult = await getAddress();

      if (addressResult.error || !addressResult.address) {
        setWalletStatus("Could not get wallet address.");
        showError(
          "Connection Failed",
          "Wallet connection failed. Please try again."
        );
        return;
      }

      const userAddress = addressResult.address;

      setWalletAddress(userAddress);
      setIsWalletConnected(true);
      setWalletStatus("Wallet connected successfully.");
      saveCache(CACHE_KEYS.walletAddress, userAddress);

      await readChapterStatus(userAddress);
    } catch (error) {
      console.error("Connect wallet error:", error);
      setWalletStatus("Wallet connection failed.");
      showError(
        "Unexpected Error",
        "Something went wrong while connecting wallet."
      );
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectWallet = () => {
    setWalletAddress("");
    setIsWalletConnected(false);
    setWalletStatus("Wallet disconnected.");
    setChapterStatus("Unknown");
    setTxStatus("No transaction yet.");
    setTxHash("");
    setErrorMessage("");
    setErrorType("");

    removeCache(CACHE_KEYS.walletAddress);
    removeCache(CACHE_KEYS.chapterStatus);
    removeCache(CACHE_KEYS.txHash);
  };

  const readChapterStatus = async (addressToCheck = walletAddress) => {
    try {
      if (!addressToCheck) {
        showError(
          "Wallet Not Connected",
          "Please connect your wallet before checking chapter status."
        );
        return;
      }

      setIsLoadingStatus(true);
      clearMessages();

      const account = await rpcServer.getAccount(addressToCheck);

      const transaction = new StellarSDK.TransactionBuilder(account, {
        fee: StellarSDK.BASE_FEE,
        networkPassphrase: StellarSDK.Networks.TESTNET,
      })
        .addOperation(
          StellarSDK.Operation.invokeContractFunction({
            contract: CONTRACT_ID,
            function: "is_unlocked",
            args: [StellarSDK.Address.fromString(addressToCheck).toScVal()],
          })
        )
        .setTimeout(30)
        .build();

      const prepared = await rpcServer.prepareTransaction(transaction);
      const response = await rpcServer.simulateTransaction(prepared);

      if (response.result && response.result.retval) {
        const value = StellarSDK.scValToNative(response.result.retval);
        const normalizedStatus = value ? "Unlocked" : "Locked";
        setChapterStatus(normalizedStatus);
        saveCache(CACHE_KEYS.chapterStatus, normalizedStatus);
      } else {
        setChapterStatus("Unknown");
        showError(
          "Read Failed",
          "Could not read chapter status from contract."
        );
      }
    } catch (error) {
      console.error("Read contract error:", error);
      setChapterStatus("Unknown");
      showError("Read Failed", "Failed to load chapter status.");
    } finally {
      setIsLoadingStatus(false);
    }
  };

  const handleUnlockChapter = async () => {
    try {
      clearMessages();
      setTxStatus("Preparing unlock transaction...");
      setIsUnlocking(true);

      if (!isWalletConnected || !walletAddress) {
        showError(
          "Wallet Not Connected",
          "Please connect your wallet before unlocking a chapter."
        );
        setTxStatus("Transaction blocked.");
        return;
      }

      const networkResult = await getNetwork();

      if (networkResult.error || networkResult.network !== "TESTNET") {
        showError(
          "Wrong Network",
          "Please switch Freighter wallet to TESTNET before signing."
        );
        setTxStatus("Transaction blocked.");
        return;
      }

      if (chapterStatus === "Unlocked") {
        showError(
          "Already Unlocked",
          "This chapter has already been unlocked for this wallet."
        );
        setTxStatus("Transaction blocked.");
        return;
      }

      const account = await rpcServer.getAccount(walletAddress);

      const transaction = new StellarSDK.TransactionBuilder(account, {
        fee: StellarSDK.BASE_FEE,
        networkPassphrase: StellarSDK.Networks.TESTNET,
      })
        .addOperation(
          StellarSDK.Operation.invokeContractFunction({
            contract: CONTRACT_ID,
            function: "unlock",
            args: [StellarSDK.Address.fromString(walletAddress).toScVal()],
          })
        )
        .setTimeout(30)
        .build();

      const prepared = await rpcServer.prepareTransaction(transaction);

      setTxStatus("Waiting for wallet signature...");

      const signed = await signTransaction(prepared.toXDR(), {
        networkPassphrase: StellarSDK.Networks.TESTNET,
        address: walletAddress,
      });

      if (signed.error || !signed.signedTxXdr) {
        showError(
          "Signature Rejected",
          "Transaction signing was cancelled or rejected by the user."
        );
        setTxStatus("Transaction failed.");
        return;
      }

      const signedTransaction = StellarSDK.TransactionBuilder.fromXDR(
        signed.signedTxXdr,
        StellarSDK.Networks.TESTNET
      );

      setTxStatus("Submitting transaction to network...");

      const sendResponse = await rpcServer.sendTransaction(signedTransaction);

      if (!sendResponse.hash) {
        showError(
          "Missing Transaction Hash",
          "The network did not return a transaction hash."
        );
        setTxStatus("Transaction failed.");
        return;
      }

      setTxHash(sendResponse.hash);
      saveCache(CACHE_KEYS.txHash, sendResponse.hash);

      setTxStatus("Transaction submitted. Waiting for confirmation...");

      while (true) {
        const getResponse = await rpcServer.getTransaction(sendResponse.hash);

        if (getResponse.status === "SUCCESS") {
          setTxStatus("Unlock transaction successful.");
          await readChapterStatus(walletAddress);
          break;
        }

        if (getResponse.status === "FAILED") {
          showError(
            "Contract Call Failed",
            "The contract call failed on testnet."
          );
          setTxStatus("Unlock transaction failed.");
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 1200));
      }
    } catch (error) {
      console.error("Unlock contract error:", error);
      const message =
        error?.message || "Something went wrong while unlocking the chapter.";
      showError("Unexpected Error", message);
      setTxStatus("Transaction failed.");
    } finally {
      setIsUnlocking(false);
    }
  };

  const copyText = async (value, successMessage) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setTxStatus(successMessage);
    } catch {
      showError("Copy Failed", "Could not copy this value.");
    }
  };

  useEffect(() => {
    loadCachedData();
  }, []);

  const chapterBadgeStyle =
    chapterStatus === "Unlocked"
      ? styles.heroStatusSuccess
      : chapterStatus === "Locked"
      ? styles.heroStatusWarning
      : styles.heroStatusNeutral;

  const walletBadgeStyle = isWalletConnected
    ? styles.successBadgeSmall
    : styles.neutralBadgeSmall;

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        <section style={styles.hero}>
          <div style={styles.heroGlow} />
          <div style={styles.heroIntro}>
            <p style={styles.eyebrow}>STELLAR MINI-DAPP</p>
            <h1 style={styles.title}>Stellar Chapter Unlock</h1>
            <p style={styles.subtitle}>
              Connect your wallet, read contract state, and unlock a chapter
              through a deployed Stellar smart contract on testnet.
            </p>
          </div>

          <div style={styles.heroMainCard}>
            <div style={styles.heroMainLeft}>
              <div style={styles.heroMetaRow}>
                <span style={styles.livePill}>⚡ Live on Testnet</span>
                <span style={chapterBadgeStyle}>
                  {chapterStatus === "Unlocked"
                    ? "🔓 Unlocked"
                    : chapterStatus === "Locked"
                    ? "🔒 Locked"
                    : "⏳ Unknown"}
                </span>
              </div>

              <h2 style={styles.heroCardTitle}>Unlock Chapter Access</h2>
              <p style={styles.heroCardDesc}>
                This is the main action of the mini-dApp. Read the latest
                chapter state from the contract and unlock access with your
                connected wallet.
              </p>

              <div style={styles.heroStats}>
                <div style={styles.heroStatBox}>
                  <div style={styles.heroStatLabel}>Smart Contract</div>
                  <div style={styles.heroStatValue}>
                    {shortenMiddle(CONTRACT_ID, 10, 8)}
                  </div>
                </div>

                <div style={styles.heroStatBox}>
                  <div style={styles.heroStatLabel}>Current State</div>
                  <div style={styles.heroStatValueBig}>
                    {isLoadingStatus ? "Loading..." : chapterStatus}
                  </div>
                </div>
              </div>

              <div style={styles.buttonRow}>
                <button
                  style={styles.ghostButton}
                  onClick={() => readChapterStatus(walletAddress)}
                  disabled={isLoadingStatus}
                >
                  {isLoadingStatus ? "Refreshing..." : "Refresh Status"}
                </button>

                <button
                  style={styles.primarySuccessButton}
                  onClick={handleUnlockChapter}
                  disabled={isUnlocking}
                >
                  {isUnlocking ? "Unlocking..." : "Unlock Chapter"}
                </button>

                <button
                  style={styles.secondaryButton}
                  onClick={() =>
                    copyText(CONTRACT_ID, "Contract address copied.")
                  }
                >
                  Copy Contract
                </button>
              </div>
            </div>

            <div style={styles.heroMainRight}>
              <div style={styles.miniInfoCard}>
                <div style={styles.miniIcon}>🧾</div>
                <div style={styles.label}>Latest Transaction Status</div>
                <div style={styles.valueLarge}>{txStatus}</div>
              </div>

              <div style={styles.miniInfoCard}>
                <div style={styles.miniIcon}>#</div>
                <div style={styles.label}>Last Transaction Hash</div>
                <div style={styles.hashValue}>
                  {txHash
                    ? shortenMiddle(txHash, 14, 12)
                    : "No transaction recorded yet"}
                </div>
              </div>
            </div>
          </div>
        </section>

        {errorMessage && (
          <div style={styles.alertBox}>
            <div style={styles.alertIcon}>⚠️</div>
            <div>
              <div style={styles.alertTitle}>{errorType || "Error"}</div>
              <div style={styles.alertText}>{errorMessage}</div>
            </div>
          </div>
        )}

        <div style={styles.bottomGrid}>
          <section style={styles.card}>
            <div style={styles.cardHeader}>
              <div>
                <h2 style={styles.cardTitle}>👛 Wallet</h2>
                <p style={styles.cardDesc}>
                  Connect your Freighter wallet and manage session state.
                </p>
              </div>
              <span style={walletBadgeStyle}>
                {isWalletConnected ? "Connected" : "Disconnected"}
              </span>
            </div>

            <div style={styles.infoPanel}>
              <div style={styles.label}>Wallet Status</div>
              <div style={styles.value}>{walletStatus}</div>
            </div>

            <div style={styles.infoPanel}>
              <div style={styles.label}>Wallet Address</div>
              <div style={styles.addressValue}>
                {walletAddress
                  ? shortenMiddle(walletAddress, 10, 8)
                  : "No wallet connected"}
              </div>
            </div>

            <div style={styles.buttonRow}>
              <button
                style={styles.primaryButton}
                onClick={handleConnectWallet}
                disabled={isConnecting}
              >
                {isConnecting ? "Connecting..." : "Connect Wallet"}
              </button>

              <button
                style={styles.secondaryButton}
                onClick={handleDisconnectWallet}
                disabled={!walletAddress}
              >
                Disconnect
              </button>

              <button
                style={styles.ghostButton}
                onClick={() =>
                  copyText(walletAddress, "Wallet address copied.")
                }
                disabled={!walletAddress}
              >
                Copy Address
              </button>
            </div>
          </section>

          <section style={styles.card}>
            <div style={styles.cardHeader}>
              <div>
                <h2 style={styles.cardTitle}>⚡ Activity</h2>
                <p style={styles.cardDesc}>
                  A quick summary of the most recent on-chain interaction.
                </p>
              </div>
              <span style={styles.liveBadge}>Live Status</span>
            </div>

            <div style={styles.timeline}>
              <div style={styles.timelineItem}>
                <div style={styles.timelineDot} />
                <div>
                  <div style={styles.timelineTitle}>Wallet Session</div>
                  <div style={styles.timelineText}>{walletStatus}</div>
                </div>
              </div>

              <div style={styles.timelineItem}>
                <div style={styles.timelineDot} />
                <div>
                  <div style={styles.timelineTitle}>Chapter State</div>
                  <div style={styles.timelineText}>{chapterStatus}</div>
                </div>
              </div>

              <div style={styles.timelineItem}>
                <div style={styles.timelineDot} />
                <div>
                  <div style={styles.timelineTitle}>Transaction Update</div>
                  <div style={styles.timelineText}>{txStatus}</div>
                </div>
              </div>
            </div>

            <div style={styles.buttonRow}>
              <button
                style={styles.secondaryButton}
                onClick={() => copyText(txHash, "Transaction hash copied.")}
                disabled={!txHash}
              >
                Copy Transaction Hash
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    margin: 0,
    background:
      "radial-gradient(circle at top, #132347 0%, #09152d 42%, #050d1d 100%)",
    padding: "28px",
    fontFamily: "Arial, sans-serif",
  },
  shell: {
    width: "100%",
    maxWidth: "1180px",
    margin: "0 auto",
  },
  hero: {
    position: "relative",
    overflow: "hidden",
    background:
      "linear-gradient(180deg, rgba(10,24,54,0.94) 0%, rgba(8,17,38,0.94) 100%)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "30px",
    padding: "34px",
    boxShadow: "0 22px 60px rgba(0,0,0,0.32)",
    marginBottom: "20px",
  },
  heroGlow: {
    position: "absolute",
    top: "-80px",
    right: "-40px",
    width: "280px",
    height: "280px",
    borderRadius: "999px",
    background:
      "radial-gradient(circle, rgba(96,165,250,0.18) 0%, rgba(139,92,246,0.12) 38%, rgba(0,0,0,0) 70%)",
    pointerEvents: "none",
  },
  heroIntro: {
    textAlign: "center",
    maxWidth: "780px",
    margin: "0 auto 26px auto",
    position: "relative",
    zIndex: 1,
  },
  eyebrow: {
    margin: "0 0 10px 0",
    color: "#7dd3fc",
    fontSize: "12px",
    fontWeight: "bold",
    letterSpacing: "0.18em",
  },
  title: {
    margin: "0 0 14px 0",
    color: "#f9fafb",
    fontSize: "46px",
    lineHeight: 1.1,
  },
  subtitle: {
    margin: "0 auto",
    color: "#cbd5e1",
    fontSize: "17px",
    lineHeight: 1.8,
    maxWidth: "760px",
  },
  heroMainCard: {
    display: "grid",
    gridTemplateColumns: "1.35fr 0.85fr",
    gap: "18px",
    alignItems: "stretch",
    position: "relative",
    zIndex: 1,
  },
  heroMainLeft: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: "22px",
    padding: "24px",
  },
  heroMainRight: {
    display: "grid",
    gap: "16px",
  },
  heroMetaRow: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    marginBottom: "16px",
  },
  livePill: {
    display: "inline-block",
    padding: "8px 12px",
    borderRadius: "999px",
    background: "rgba(125, 211, 252, 0.12)",
    color: "#7dd3fc",
    border: "1px solid rgba(125, 211, 252, 0.18)",
    fontSize: "13px",
    fontWeight: "bold",
  },
  heroStatusSuccess: {
    display: "inline-block",
    padding: "8px 12px",
    borderRadius: "999px",
    background: "rgba(16,185,129,0.16)",
    color: "#6ee7b7",
    border: "1px solid rgba(16,185,129,0.22)",
    fontSize: "13px",
    fontWeight: "bold",
  },
  heroStatusWarning: {
    display: "inline-block",
    padding: "8px 12px",
    borderRadius: "999px",
    background: "rgba(245,158,11,0.16)",
    color: "#fcd34d",
    border: "1px solid rgba(245,158,11,0.22)",
    fontSize: "13px",
    fontWeight: "bold",
  },
  heroStatusNeutral: {
    display: "inline-block",
    padding: "8px 12px",
    borderRadius: "999px",
    background: "rgba(148,163,184,0.14)",
    color: "#cbd5e1",
    border: "1px solid rgba(148,163,184,0.2)",
    fontSize: "13px",
    fontWeight: "bold",
  },
  heroCardTitle: {
    margin: "0 0 10px 0",
    fontSize: "30px",
    color: "#f8fafc",
  },
  heroCardDesc: {
    margin: 0,
    color: "#a5b4fc",
    fontSize: "15px",
    lineHeight: 1.8,
    maxWidth: "620px",
  },
  heroStats: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "14px",
    marginTop: "20px",
  },
  heroStatBox: {
    background: "#0b1730",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: "18px",
    padding: "16px",
    minHeight: "96px",
  },
  heroStatLabel: {
    fontSize: "12px",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: "10px",
    fontWeight: "bold",
  },
  heroStatValue: {
    fontSize: "15px",
    color: "#93c5fd",
    lineHeight: 1.6,
    wordBreak: "break-all",
    fontWeight: "600",
  },
  heroStatValueBig: {
    fontSize: "24px",
    color: "#f8fafc",
    fontWeight: "bold",
  },
  miniInfoCard: {
    background: "#0b1730",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: "20px",
    padding: "18px",
    minHeight: "120px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },
  miniIcon: {
    fontSize: "20px",
    marginBottom: "10px",
  },
  alertBox: {
    display: "grid",
    gridTemplateColumns: "28px 1fr",
    gap: "12px",
    alignItems: "start",
    background: "rgba(127, 29, 29, 0.18)",
    border: "1px solid rgba(248, 113, 113, 0.22)",
    borderRadius: "18px",
    padding: "16px 18px",
    marginBottom: "20px",
    color: "#fecaca",
  },
  alertIcon: {
    fontSize: "20px",
    lineHeight: 1.2,
  },
  alertTitle: {
    fontWeight: "bold",
    marginBottom: "6px",
    fontSize: "15px",
  },
  alertText: {
    fontSize: "14px",
    lineHeight: 1.6,
  },
  bottomGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: "20px",
  },
  card: {
    background: "rgba(17, 24, 39, 0.88)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "24px",
    padding: "22px",
    boxShadow: "0 18px 50px rgba(0,0,0,0.22)",
    color: "#f9fafb",
    minHeight: "320px",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
    marginBottom: "18px",
    flexWrap: "wrap",
  },
  cardTitle: {
    margin: 0,
    fontSize: "24px",
    color: "#f8fafc",
  },
  cardDesc: {
    margin: "8px 0 0 0",
    fontSize: "14px",
    lineHeight: 1.6,
    color: "#94a3b8",
  },
  infoPanel: {
    background: "#0b1730",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: "16px",
    padding: "14px 16px",
    marginTop: "14px",
    minHeight: "86px",
  },
  label: {
    fontSize: "12px",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: "8px",
    fontWeight: "bold",
  },
  value: {
    fontSize: "16px",
    color: "#e5e7eb",
    lineHeight: 1.6,
  },
  valueLarge: {
    fontSize: "17px",
    color: "#e5e7eb",
    lineHeight: 1.7,
    fontWeight: "600",
  },
  addressValue: {
    fontSize: "14px",
    color: "#93c5fd",
    lineHeight: 1.6,
    wordBreak: "break-all",
  },
  hashValue: {
    fontSize: "14px",
    color: "#fda4af",
    lineHeight: 1.6,
    wordBreak: "break-all",
  },
  buttonRow: {
    display: "flex",
    gap: "12px",
    marginTop: "18px",
    flexWrap: "wrap",
  },
  primaryButton: {
    background: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
    color: "white",
    border: "none",
    padding: "12px 18px",
    borderRadius: "14px",
    cursor: "pointer",
    fontSize: "15px",
    fontWeight: "bold",
    boxShadow: "0 10px 24px rgba(124,58,237,0.28)",
  },
  primarySuccessButton: {
    background: "linear-gradient(135deg, #10b981, #059669)",
    color: "white",
    border: "none",
    padding: "12px 18px",
    borderRadius: "14px",
    cursor: "pointer",
    fontSize: "15px",
    fontWeight: "bold",
    boxShadow: "0 10px 24px rgba(5,150,105,0.25)",
  },
  secondaryButton: {
    background: "rgba(255,255,255,0.07)",
    color: "white",
    border: "1px solid rgba(255,255,255,0.08)",
    padding: "12px 18px",
    borderRadius: "14px",
    cursor: "pointer",
    fontSize: "15px",
    fontWeight: "bold",
  },
  ghostButton: {
    background: "rgba(14,165,233,0.16)",
    color: "#7dd3fc",
    border: "1px solid rgba(14,165,233,0.22)",
    padding: "12px 18px",
    borderRadius: "14px",
    cursor: "pointer",
    fontSize: "15px",
    fontWeight: "bold",
  },
  successBadgeSmall: {
    display: "inline-block",
    padding: "8px 12px",
    borderRadius: "999px",
    background: "rgba(16,185,129,0.16)",
    color: "#6ee7b7",
    border: "1px solid rgba(16,185,129,0.22)",
    fontWeight: "bold",
    fontSize: "13px",
  },
  neutralBadgeSmall: {
    display: "inline-block",
    padding: "8px 12px",
    borderRadius: "999px",
    background: "rgba(148,163,184,0.14)",
    color: "#cbd5e1",
    border: "1px solid rgba(148,163,184,0.2)",
    fontWeight: "bold",
    fontSize: "13px",
  },
  liveBadge: {
    display: "inline-block",
    padding: "8px 12px",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.06)",
    color: "#d1d5db",
    border: "1px solid rgba(255,255,255,0.08)",
    fontWeight: "bold",
    fontSize: "13px",
  },
  timeline: {
    display: "grid",
    gap: "16px",
    marginTop: "10px",
  },
  timelineItem: {
    display: "grid",
    gridTemplateColumns: "12px 1fr",
    gap: "14px",
    alignItems: "start",
  },
  timelineDot: {
    width: "12px",
    height: "12px",
    borderRadius: "999px",
    background: "linear-gradient(135deg, #60a5fa, #8b5cf6)",
    marginTop: "6px",
    boxShadow: "0 0 16px rgba(96,165,250,0.45)",
  },
  timelineTitle: {
    fontSize: "14px",
    fontWeight: "bold",
    color: "#f8fafc",
    marginBottom: "6px",
  },
  timelineText: {
    fontSize: "14px",
    lineHeight: 1.7,
    color: "#cbd5e1",
  },
};

export default App;