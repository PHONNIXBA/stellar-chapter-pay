import { useState } from "react";
import {
  getAddress,
  getNetwork,
  isConnected,
  setAllowed,
  signTransaction,
} from "@stellar/freighter-api";
import * as StellarSDK from "@stellar/stellar-sdk";

function App() {
  const CONTRACT_ID =
    "CA4OE7GBLEUISESUKWDOLTX4B25CNFWZMGT4LIMFOWOYW5L3MD7WV6RI";

  const rpcServer = new StellarSDK.rpc.Server(
    "https://soroban-testnet.stellar.org:443"
  );

  const [walletAddress, setWalletAddress] = useState("");
  const [walletStatus, setWalletStatus] = useState("Wallet not connected");
  const [isWalletConnected, setIsWalletConnected] = useState(false);

  const [chapterStatus, setChapterStatus] = useState("Unknown");
  const [txStatus, setTxStatus] = useState("No transaction yet.");
  const [txHash, setTxHash] = useState("");

  const [errorMessage, setErrorMessage] = useState("");
  const [errorType, setErrorType] = useState("");

  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);

  const clearMessages = () => {
    setErrorMessage("");
    setErrorType("");
    setTxHash("");
  };

  const showError = (type, message) => {
    setErrorType(type);
    setErrorMessage(message);
  };

  const handleConnectWallet = async () => {
    try {
      clearMessages();
      setWalletStatus("Checking wallet...");

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

      await readChapterStatus(userAddress);
    } catch (error) {
      console.error("Connect wallet error:", error);
      setWalletStatus("Wallet connection failed.");
      showError(
        "Unexpected Error",
        "Something went wrong while connecting wallet."
      );
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
        setChapterStatus(value ? "Unlocked" : "Locked");
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
      setTxStatus("Transaction submitted. Waiting for confirmation...");

      while (true) {
        const getResponse = await rpcServer.getTransaction(sendResponse.hash);

        if (getResponse.status === "SUCCESS") {
          setTxStatus("Unlock transaction successful.");
          await readChapterStatus(walletAddress);
          break;
        }

        if (getResponse.status === "FAILED") {
          console.error("Failed transaction response:", getResponse);
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

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Stellar Chapter Unlock</h1>
        <p style={styles.subtitle}>
          Level 2 demo: frontend calls a deployed Stellar smart contract to
          unlock a chapter.
        </p>

        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Wallet</h2>
          <p style={styles.text}>{walletStatus}</p>

          {walletAddress && (
            <div style={styles.infoBox}>
              <strong>Wallet Address:</strong>
              <p style={styles.addressText}>{walletAddress}</p>
            </div>
          )}

          <div style={styles.buttonRow}>
            <button style={styles.button} onClick={handleConnectWallet}>
              Connect Wallet
            </button>

            <button
              style={styles.disconnectButton}
              onClick={handleDisconnectWallet}
              disabled={!isWalletConnected}
            >
              Disconnect
            </button>
          </div>
        </div>

        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Contract</h2>

          <div style={styles.infoBox}>
            <strong>Contract Address:</strong>
            <p style={styles.addressText}>{CONTRACT_ID}</p>
          </div>

          <div style={styles.infoBox}>
            <strong>Chapter Status:</strong>
            <p
              style={{
                ...styles.statusText,
                color: chapterStatus === "Unlocked" ? "#34d399" : "#fbbf24",
              }}
            >
              {isLoadingStatus ? "Loading..." : chapterStatus}
            </p>
          </div>

          <div style={styles.buttonRow}>
            <button
              style={styles.refreshButton}
              onClick={() => readChapterStatus(walletAddress)}
              disabled={isLoadingStatus}
            >
              Refresh Status
            </button>

            <button
              style={styles.unlockButton}
              onClick={handleUnlockChapter}
              disabled={isUnlocking}
            >
              {isUnlocking ? "Unlocking..." : "Unlock Chapter"}
            </button>
          </div>
        </div>

        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Transaction</h2>

          <div style={styles.infoBox}>
            <strong>Transaction Status:</strong>
            <p style={styles.textSmall}>{txStatus}</p>
          </div>

          {txHash && (
            <div style={styles.infoBox}>
              <strong>Transaction Hash:</strong>
              <p style={styles.hashText}>{txHash}</p>
            </div>
          )}

          {errorMessage && (
            <div style={styles.errorBox}>
              <strong>{errorType || "Error"}:</strong>
              <p style={styles.errorText}>{errorMessage}</p>
            </div>
          )}
        </div>

        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Handled Error Types</h2>
          <ul style={styles.list}>
            <li>Wallet not connected</li>
            <li>Wrong network</li>
            <li>Already unlocked</li>
            <li>Signature rejected</li>
            <li>Contract call failed</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    margin: 0,
    backgroundColor: "#0f172a",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "24px",
    fontFamily: "Arial, sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: "820px",
    backgroundColor: "#111827",
    color: "#f9fafb",
    borderRadius: "16px",
    padding: "32px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
  },
  title: {
    margin: "0 0 12px 0",
    fontSize: "34px",
    color: "#a78bfa",
    textAlign: "center",
  },
  subtitle: {
    margin: "0 0 24px 0",
    fontSize: "17px",
    color: "#d1d5db",
    textAlign: "center",
    lineHeight: "1.6",
  },
  section: {
    marginTop: "24px",
    padding: "20px",
    backgroundColor: "#1f2937",
    borderRadius: "12px",
  },
  sectionTitle: {
    margin: "0 0 16px 0",
    fontSize: "22px",
    color: "#fbbf24",
    textAlign: "center",
  },
  text: {
    margin: 0,
    fontSize: "16px",
    lineHeight: "1.6",
    color: "#e5e7eb",
    textAlign: "center",
  },
  textSmall: {
    marginTop: "8px",
    fontSize: "14px",
    lineHeight: "1.6",
    color: "#e5e7eb",
    wordBreak: "break-word",
  },
  infoBox: {
    marginTop: "16px",
    padding: "14px",
    backgroundColor: "#111827",
    borderRadius: "10px",
    border: "1px solid #374151",
  },
  errorBox: {
    marginTop: "16px",
    padding: "14px",
    backgroundColor: "#2b1414",
    borderRadius: "10px",
    border: "1px solid #7f1d1d",
  },
  errorText: {
    marginTop: "8px",
    fontSize: "14px",
    lineHeight: "1.6",
    color: "#fca5a5",
    wordBreak: "break-word",
  },
  addressText: {
    marginTop: "8px",
    fontSize: "14px",
    lineHeight: "1.6",
    color: "#93c5fd",
    wordBreak: "break-all",
  },
  hashText: {
    marginTop: "8px",
    fontSize: "14px",
    lineHeight: "1.6",
    color: "#fca5a5",
    wordBreak: "break-all",
  },
  statusText: {
    marginTop: "8px",
    fontSize: "22px",
    fontWeight: "bold",
    textAlign: "center",
  },
  buttonRow: {
    display: "flex",
    gap: "12px",
    marginTop: "18px",
    flexWrap: "wrap",
  },
  button: {
    backgroundColor: "#8b5cf6",
    color: "white",
    border: "none",
    padding: "12px 18px",
    borderRadius: "10px",
    cursor: "pointer",
    fontSize: "15px",
    fontWeight: "bold",
  },
  disconnectButton: {
    backgroundColor: "#374151",
    color: "white",
    border: "none",
    padding: "12px 18px",
    borderRadius: "10px",
    cursor: "pointer",
    fontSize: "15px",
    fontWeight: "bold",
  },
  refreshButton: {
    backgroundColor: "#0ea5e9",
    color: "white",
    border: "none",
    padding: "12px 18px",
    borderRadius: "10px",
    cursor: "pointer",
    fontSize: "15px",
    fontWeight: "bold",
  },
  unlockButton: {
    backgroundColor: "#10b981",
    color: "white",
    border: "none",
    padding: "12px 18px",
    borderRadius: "10px",
    cursor: "pointer",
    fontSize: "15px",
    fontWeight: "bold",
  },
  list: {
    margin: 0,
    paddingLeft: "20px",
    lineHeight: "1.9",
    color: "#e5e7eb",
    fontSize: "15px",
  },
};

export default App;