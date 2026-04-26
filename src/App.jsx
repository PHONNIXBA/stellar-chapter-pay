import { useEffect, useMemo, useState } from "react";
import {
  getAddress,
  getNetwork,
  isConnected,
  setAllowed,
  signTransaction,
} from "@stellar/freighter-api";
import * as StellarSDK from "@stellar/stellar-sdk";

const RPC_URL = "https://soroban-testnet.stellar.org:443";

const CACHE_KEYS = {
  walletAddress: "stellar_chapter_wallet_address",
  unlockedCount: "stellar_unlocked_count",
  txHash: "stellar_chapter_tx_hash",
  tokenBalance: "stellar_chapter_token_balance",
};

function shortenMiddle(value, start = 8, end = 6) {
  if (!value || value.length <= start + end + 3) return value;
  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

function App() {
  const rpcServer = useMemo(() => new StellarSDK.rpc.Server(RPC_URL), []);
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 900 : false
  );

  const [chapterContractId, setChapterContractId] = useState("");
  const [tokenContractId, setTokenContractId] = useState("");
  const [contractsLoaded, setContractsLoaded] = useState(false);

  const [walletAddress, setWalletAddress] = useState("");
  const [walletStatus, setWalletStatus] = useState("Wallet not connected");
  const [isWalletConnected, setIsWalletConnected] = useState(false);

  const [unlockedCount, setUnlockedCount] = useState("0");
  const [pricePerChapter, setPricePerChapter] = useState("...");
  const [tokenBalance, setTokenBalance] = useState("0");
  const [quantity, setQuantity] = useState("1");

  const [txStatus, setTxStatus] = useState("No transaction yet.");
  const [txHash, setTxHash] = useState("");

  const [errorMessage, setErrorMessage] = useState("");
  const [errorType, setErrorType] = useState("");

  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);

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
    const cachedUnlockedCount = localStorage.getItem(CACHE_KEYS.unlockedCount);
    const cachedTxHash = localStorage.getItem(CACHE_KEYS.txHash);
    const cachedTokenBalance = localStorage.getItem(CACHE_KEYS.tokenBalance);

    if (cachedWallet) {
      setWalletAddress(cachedWallet);
      setWalletStatus("Cached wallet found. Reconnect to refresh live data.");
    }

    if (cachedUnlockedCount) {
      setUnlockedCount(cachedUnlockedCount);
    }

    if (cachedTxHash) {
      setTxHash(cachedTxHash);
      setTxStatus("Loaded last transaction from cache.");
    }

    if (cachedTokenBalance) {
      setTokenBalance(cachedTokenBalance);
    }
  };

  const loadContractsConfig = async () => {
    try {
      const response = await fetch("/contracts.json");
      if (!response.ok) {
        throw new Error("contracts.json not found");
      }

      const data = await response.json();

      setChapterContractId((data.chapter_contract_id || "").trim());
      setTokenContractId((data.token_contract_id || "").trim());
      setContractsLoaded(true);
    } catch (error) {
      console.error("Failed to load contracts config:", error);
      showError(
        "Config Load Failed",
        "Could not load contract addresses from contracts.json."
      );
    }
  };

  async function simulateContractCall(contractId, functionName, args, source) {
    const account = await rpcServer.getAccount(source);

    const tx = new StellarSDK.TransactionBuilder(account, {
      fee: StellarSDK.BASE_FEE,
      networkPassphrase: StellarSDK.Networks.TESTNET,
    })
      .addOperation(
        StellarSDK.Operation.invokeContractFunction({
          contract: contractId,
          function: functionName,
          args,
        })
      )
      .setTimeout(30)
      .build();

    const prepared = await rpcServer.prepareTransaction(tx);
    const response = await rpcServer.simulateTransaction(prepared);

    if (response.result && response.result.retval) {
      return StellarSDK.scValToNative(response.result.retval);
    }

    return null;
  }

  async function signedInvoke(contractId, functionName, args) {
    const account = await rpcServer.getAccount(walletAddress);

    const tx = new StellarSDK.TransactionBuilder(account, {
      fee: StellarSDK.BASE_FEE,
      networkPassphrase: StellarSDK.Networks.TESTNET,
    })
      .addOperation(
        StellarSDK.Operation.invokeContractFunction({
          contract: contractId,
          function: functionName,
          args,
        })
      )
      .setTimeout(30)
      .build();

    const prepared = await rpcServer.prepareTransaction(tx);

    const signed = await signTransaction(prepared.toXDR(), {
      networkPassphrase: StellarSDK.Networks.TESTNET,
      address: walletAddress,
    });

    if (signed.error || !signed.signedTxXdr) {
      throw new Error("Transaction signing was cancelled or rejected.");
    }

    const signedTransaction = StellarSDK.TransactionBuilder.fromXDR(
      signed.signedTxXdr,
      StellarSDK.Networks.TESTNET
    );

    const sendResponse = await rpcServer.sendTransaction(signedTransaction);

    if (!sendResponse.hash) {
      throw new Error("No transaction hash returned.");
    }

    setTxHash(sendResponse.hash);
    saveCache(CACHE_KEYS.txHash, sendResponse.hash);

    while (true) {
      const getResponse = await rpcServer.getTransaction(sendResponse.hash);

      if (getResponse.status === "SUCCESS") {
        return sendResponse.hash;
      }

      if (getResponse.status === "FAILED") {
        throw new Error("Transaction failed on testnet.");
      }

      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
  }

  const readUnlockedCount = async (addressToCheck = walletAddress) => {
    if (!addressToCheck) return;
    if (!chapterContractId) {
      showError("Missing Config", "Chapter contract address is not loaded yet.");
      return;
    }

    try {
      setIsLoadingStatus(true);

      const count = await simulateContractCall(
        chapterContractId,
        "get_unlocked_count",
        [StellarSDK.nativeToScVal(addressToCheck, { type: "address" })],
        addressToCheck
      );

      const normalized = String(count ?? 0).replace(/n$/, "");
      setUnlockedCount(normalized);
      saveCache(CACHE_KEYS.unlockedCount, normalized);
    } catch (error) {
      console.error(error);
      showError("Read Failed", "Failed to load unlocked chapter count.");
    } finally {
      setIsLoadingStatus(false);
    }
  };

  const readPricePerChapter = async (addressToCheck = walletAddress) => {
    if (!addressToCheck) return;
    if (!chapterContractId) return;

    try {
      const price = await simulateContractCall(
        chapterContractId,
        "get_price_per_chapter",
        [],
        addressToCheck
      );
      setPricePerChapter(String(price ?? "...").replace(/n$/, ""));
    } catch (error) {
      console.error(error);
      setPricePerChapter("...");
    }
  };

  const readTokenBalance = async (addressToCheck = walletAddress) => {
    if (!addressToCheck) return;
    if (!tokenContractId) {
      showError("Missing Config", "Coins contract address is not loaded yet.");
      return;
    }

    try {
      const balance = await simulateContractCall(
        tokenContractId,
        "balance",
        [StellarSDK.nativeToScVal(addressToCheck, { type: "address" })],
        addressToCheck
      );

      const normalized = String(balance ?? 0).replace(/n$/, "");
      setTokenBalance(normalized);
      saveCache(CACHE_KEYS.tokenBalance, normalized);
    } catch (error) {
      console.error(error);
      setTokenBalance("0");
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

      if (networkResult.error || networkResult.network !== "TESTNET") {
        setWalletStatus("Wrong network.");
        showError("Wrong Network", "Please switch Freighter to TESTNET.");
        return;
      }

      await setAllowed();

      const addressResult = await getAddress();

      if (addressResult.error || !addressResult.address) {
        setWalletStatus("Could not get wallet address.");
        showError("Connection Failed", "Wallet connection failed.");
        return;
      }

      const userAddress = addressResult.address;

      setWalletAddress(userAddress);
      setIsWalletConnected(true);
      setWalletStatus("Wallet connected successfully.");
      saveCache(CACHE_KEYS.walletAddress, userAddress);

      if (!contractsLoaded) {
        await loadContractsConfig();
      }

      await Promise.all([
        readUnlockedCount(userAddress),
        readTokenBalance(userAddress),
        readPricePerChapter(userAddress),
      ]);
    } catch (error) {
      console.error(error);
      showError("Unexpected Error", "Something went wrong while connecting.");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectWallet = () => {
    setWalletAddress("");
    setIsWalletConnected(false);
    setWalletStatus("Wallet disconnected.");
    setUnlockedCount("0");
    setPricePerChapter("...");
    setTokenBalance("0");
    setQuantity("1");
    setTxStatus("No transaction yet.");
    setTxHash("");
    setErrorMessage("");
    setErrorType("");

    removeCache(CACHE_KEYS.walletAddress);
    removeCache(CACHE_KEYS.unlockedCount);
    removeCache(CACHE_KEYS.txHash);
    removeCache(CACHE_KEYS.tokenBalance);
  };

  const handleClaimCoins = async () => {
  try {
    clearMessages();
    setIsClaiming(true);
    setTxStatus("Preparing demo Coins claim...");

    if (!walletAddress) {
      showError("Wallet Not Connected", "Please connect your wallet first.");
      return;
    }

    if (!tokenContractId) {
      showError("Missing Config", "Coins contract address is not loaded yet.");
      return;
    }

    await signedInvoke(tokenContractId, "faucet", [
      StellarSDK.nativeToScVal(walletAddress, { type: "address" }),
    ]);

    setTxStatus("Demo Coins claimed successfully.");
    await readTokenBalance(walletAddress);
  } catch (error) {
    console.error("Claim error full:", error);
    console.error("Claim error message:", error?.message);

    const rawMessage = String(error?.message || "").toLowerCase();

    if (
      rawMessage.includes("already") ||
      rawMessage.includes("claimed") ||
      rawMessage.includes("faucet")
    ) {
      showError(
        "Already Claimed",
        "You have already claimed your demo Coins with this wallet."
      );
      setTxStatus("Demo Coins already claimed.");
    } else {
      showError(
        "Claim Failed",
        "Could not claim demo Coins. Please try again."
      );
      setTxStatus("Claim failed.");
    }
  } finally {
    setIsClaiming(false);
  }
};

  const handleUnlockChapters = async () => {
  try {
    clearMessages();
    setTxStatus("Preparing unlock transaction...");
    setIsUnlocking(true);

    if (!walletAddress) {
      showError("Wallet Not Connected", "Please connect your wallet first.");
      return;
    }

    if (!chapterContractId) {
      showError("Missing Config", "Chapter contract address is not loaded yet.");
      return;
    }

    const quantityNumber = Number(quantity);

    if (!Number.isInteger(quantityNumber) || quantityNumber <= 0) {
      showError(
        "Invalid Quantity",
        "Please enter a valid number of chapters to unlock."
      );
      setTxStatus("Transaction blocked.");
      return;
    }

    const numericBalance = Number(String(tokenBalance).replace(/n$/, "")) || 0;
    const numericPrice = Number(String(pricePerChapter).replace(/n$/, "")) || 0;
    const totalNeeded = quantityNumber * numericPrice;

    if (numericBalance < totalNeeded) {
      showError(
        "Insufficient Coins",
        "You do not have enough Coins to unlock this number of chapters."
      );
      setTxStatus("Unlock blocked: not enough Coins.");
      return;
    }

    await signedInvoke(chapterContractId, "unlock_with_payment", [
      StellarSDK.nativeToScVal(walletAddress, { type: "address" }),
      StellarSDK.nativeToScVal(quantityNumber, { type: "u32" }),
    ]);

    setTxStatus("Unlock transaction successful.");
    await Promise.all([
      readUnlockedCount(walletAddress),
      readTokenBalance(walletAddress),
    ]);
  } catch (error) {
    console.error("Unlock error full:", error);
    console.error("Unlock error message:", error?.message);

    const rawMessage = String(error?.message || "").toLowerCase();

    if (
      rawMessage.includes("insufficient") ||
      rawMessage.includes("balance") ||
      rawMessage.includes("transfer")
    ) {
      showError(
        "Insufficient Coins",
        "You do not have enough Coins to unlock this number of chapters."
      );
      setTxStatus("Unlock failed: insufficient Coins.");
    } else {
      showError(
        "Unlock Failed",
        "Could not unlock chapters. Please try again."
      );
      setTxStatus("Unlock failed.");
    }
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
    loadContractsConfig();

    const onResize = () => {
      setIsMobile(window.innerWidth < 900);
    };

    onResize();
    window.addEventListener("resize", onResize);

    return () => window.removeEventListener("resize", onResize);
  }, []);

  const quantityNumber =
    Number.isInteger(Number(quantity)) && Number(quantity) > 0
      ? Number(quantity)
      : 0;

  const numericPrice =
    pricePerChapter !== "..." ? Number(String(pricePerChapter).replace(/n$/, "")) : 0;

  const totalPrice = quantityNumber > 0 ? numericPrice * quantityNumber : 0;

  const unlockedCountNumber = Number(String(unlockedCount).replace(/n$/, "")) || 0;

  const accessBadgeStyle =
    unlockedCountNumber > 0 ? styles.heroStatusSuccess : styles.heroStatusWarning;

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        <section style={styles.hero}>
          <div style={styles.heroGlow} />
          <div style={styles.heroIntro}>
            <p style={styles.eyebrow}>STELLAR LEVEL 4 MINI-DAPP</p>
            <h1 style={styles.title}>Bulk Chapter Unlock With Coins</h1>
            <p style={styles.subtitle}>
              Choose how many chapters you want to unlock, pay once with Coins,
              and unlock multiple chapters in a single transaction.
            </p>
          </div>

          <div
            style={{
              ...styles.heroMainCard,
              gridTemplateColumns: isMobile ? "1fr" : "1.35fr 0.85fr",
            }}
          >
            <div style={styles.heroMainLeft}>
              <div style={styles.heroMetaRow}>
                <span style={styles.livePill}>⚡ Live on Testnet</span>
                <span style={accessBadgeStyle}>
                  {unlockedCountNumber > 0
                    ? `📖 ${unlockedCountNumber} Chapters Unlocked`
                    : "🔒 No Chapters Unlocked"}
                </span>
              </div>

              <h2 style={styles.heroCardTitle}>Unlock Multiple Chapters</h2>
              <p style={styles.heroCardDesc}>
                Each chapter costs 5 Coins. Select how many chapters you want to
                unlock, and the app will calculate the total price automatically.
              </p>

              <div style={styles.heroStats}>
                <div style={styles.heroStatBox}>
                  <div style={styles.heroStatLabel}>Chapter Contract</div>
                  <div style={styles.heroStatValue}>
                    {contractsLoaded
                      ? shortenMiddle(chapterContractId, 10, 8)
                      : "Loading..."}
                  </div>
                </div>

                <div style={styles.heroStatBox}>
                  <div style={styles.heroStatLabel}>Coins Contract</div>
                  <div style={styles.heroStatValue}>
                    {contractsLoaded
                      ? shortenMiddle(tokenContractId, 10, 8)
                      : "Loading..."}
                  </div>
                </div>

                <div style={styles.heroStatBox}>
                  <div style={styles.heroStatLabel}>Price Per Chapter</div>
                  <div style={styles.heroStatValueBig}>{pricePerChapter} Coins</div>
                </div>

                <div style={styles.heroStatBox}>
                  <div style={styles.heroStatLabel}>Your Coins Balance</div>
                  <div style={styles.heroStatValueBig}>{tokenBalance}</div>
                </div>

                <div style={styles.heroStatBox}>
                  <div style={styles.heroStatLabel}>Chapters To Unlock</div>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    style={styles.numberInput}
                  />
                </div>

                <div style={styles.heroStatBox}>
                  <div style={styles.heroStatLabel}>Total Price</div>
                  <div style={styles.heroStatValueBig}>{totalPrice} Coins</div>
                </div>
              </div>

              <div style={styles.buttonRow}>
                <button
                  style={styles.ghostButton}
                  onClick={() => {
                    readUnlockedCount(walletAddress);
                    readTokenBalance(walletAddress);
                    readPricePerChapter(walletAddress);
                  }}
                  disabled={isLoadingStatus || !contractsLoaded}
                >
                  {isLoadingStatus ? "Refreshing..." : "Refresh Status"}
                </button>

                <button
                  style={styles.primaryButton}
                  onClick={handleClaimCoins}
                  disabled={isClaiming || !contractsLoaded}
                >
                  {isClaiming ? "Claiming..." : "Claim Demo Coins"}
                </button>

                <button
                  style={styles.primarySuccessButton}
                  onClick={handleUnlockChapters}
                  disabled={isUnlocking || !contractsLoaded}
                >
                  {isUnlocking ? "Unlocking..." : "Unlock Chapters"}
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

        <div
          style={{
            ...styles.bottomGrid,
            gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(320px, 1fr))",
          }}
        >
          <section style={styles.card}>
            <div style={styles.cardHeader}>
              <div>
                <h2 style={styles.cardTitle}>👛 Wallet</h2>
                <p style={styles.cardDesc}>
                  Connect your Freighter wallet and manage session state.
                </p>
              </div>
              <span
                style={
                  isWalletConnected
                    ? styles.successBadgeSmall
                    : styles.neutralBadgeSmall
                }
              >
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
                  A quick summary of wallet, balance, quantity, and unlock flow.
                </p>
              </div>
              <span style={styles.liveBadge}>Bulk Unlock Flow</span>
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
                  <div style={styles.timelineTitle}>Coins Balance</div>
                  <div style={styles.timelineText}>{tokenBalance} Coins</div>
                </div>
              </div>

              <div style={styles.timelineItem}>
                <div style={styles.timelineDot} />
                <div>
                  <div style={styles.timelineTitle}>Selected Quantity</div>
                  <div style={styles.timelineText}>
                    {quantityNumber || 0} chapter(s)
                  </div>
                </div>
              </div>

              <div style={styles.timelineItem}>
                <div style={styles.timelineDot} />
                <div>
                  <div style={styles.timelineTitle}>Unlocked Chapters</div>
                  <div style={styles.timelineText}>
                    {unlockedCountNumber} chapter(s)
                  </div>
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
    padding: "20px",
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
    padding: "28px",
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
    fontSize: "42px",
    lineHeight: 1.1,
  },
  subtitle: {
    margin: "0 auto",
    color: "#cbd5e1",
    fontSize: "16px",
    lineHeight: 1.8,
    maxWidth: "760px",
  },
  heroMainCard: {
    display: "grid",
    gap: "18px",
    alignItems: "stretch",
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
  heroCardTitle: {
    margin: "0 0 10px 0",
    fontSize: "28px",
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
    fontSize: "22px",
    color: "#f8fafc",
    fontWeight: "bold",
  },
  numberInput: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "12px",
    border: "1px solid rgba(255,255,255,0.1)",
    background: "#111827",
    color: "#f9fafb",
    fontSize: "16px",
    outline: "none",
    boxSizing: "border-box",
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