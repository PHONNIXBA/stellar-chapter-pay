import { useState } from "react";
import {
  setAllowed,
  getAddress,
  isConnected,
  signTransaction,
  getNetwork,
} from "@stellar/freighter-api";
import {
  Horizon,
  Networks,
  TransactionBuilder,
  Operation,
  Asset,
} from "@stellar/stellar-sdk";

function App() {
  const [walletAddress, setWalletAddress] = useState("");
  const [walletStatus, setWalletStatus] = useState("Wallet not connected");
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [balance, setBalance] = useState("");

  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("");
  const [txStatus, setTxStatus] = useState("No transaction yet.");
  const [txHash, setTxHash] = useState("");

  const TESTNET_SERVER = "https://horizon-testnet.stellar.org";
  const server = new Horizon.Server(TESTNET_SERVER);

  const loadBalance = async (address) => {
    const account = await server.loadAccount(address);
    const xlmBalance = account.balances.find(
      (item) => item.asset_type === "native"
    );
    setBalance(xlmBalance ? xlmBalance.balance : "0");
  };

  const handleConnectWallet = async () => {
    try {
      setWalletStatus("Checking Freighter wallet...");

      const connected = await isConnected();
      if (!connected.isConnected) {
        setWalletStatus("Freighter wallet is not installed in your browser.");
        return;
      }

      await setAllowed();

      const addressResult = await getAddress();
      if (addressResult.error || !addressResult.address) {
        setWalletStatus("Could not get wallet address.");
        return;
      }

      const networkResult = await getNetwork();
      if (networkResult.error) {
        setWalletStatus("Could not read Freighter network.");
        return;
      }

      if (networkResult.network !== "TESTNET") {
        setWalletStatus("Please switch Freighter wallet to TESTNET.");
        return;
      }

      const userAddress = addressResult.address;
      setWalletAddress(userAddress);
      setIsWalletConnected(true);

      await loadBalance(userAddress);
      setWalletStatus("Wallet connected successfully.");
    } catch (error) {
      console.error("Wallet connection error:", error);
      setWalletStatus("Something went wrong while connecting wallet.");
    }
  };

  const handleDisconnectWallet = () => {
    setWalletAddress("");
    setBalance("");
    setIsWalletConnected(false);
    setWalletStatus("Wallet disconnected.");
    setDestination("");
    setAmount("");
    setTxStatus("No transaction yet.");
    setTxHash("");
  };

  const handleSendPayment = async () => {
    try {
      setTxStatus("Preparing transaction...");
      setTxHash("");

      if (!walletAddress) {
        setTxStatus("Please connect your wallet first.");
        return;
      }

      if (!destination || !amount) {
        setTxStatus("Please enter destination address and amount.");
        return;
      }

      const networkResult = await getNetwork();
      if (networkResult.error) {
        setTxStatus("Could not verify Freighter network.");
        return;
      }

      if (networkResult.network !== "TESTNET") {
        setTxStatus("Freighter wallet is not on TESTNET.");
        return;
      }

      const sourceAccount = await server.loadAccount(walletAddress);

      const transaction = new TransactionBuilder(sourceAccount, {
        fee: "100",
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          Operation.payment({
            destination,
            asset: Asset.native(),
            amount,
          })
        )
        .setTimeout(60)
        .build();

      const signed = await signTransaction(transaction.toXDR(), {
        networkPassphrase: Networks.TESTNET,
        address: walletAddress,
      });

      if (signed.error || !signed.signedTxXdr) {
        setTxStatus("Transaction signing was cancelled or failed.");
        return;
      }

      const signedTransaction = TransactionBuilder.fromXDR(
        signed.signedTxXdr,
        Networks.TESTNET
      );

      const response = await server.submitTransaction(signedTransaction);

      setTxStatus("Transaction sent successfully.");
      setTxHash(response.hash);

      await loadBalance(walletAddress);
    } catch (error) {
      console.error("Full transaction error:", error);

      const errorMessage =
        error?.response?.data?.extras?.result_codes?.operations?.join(", ") ||
        error?.response?.data?.detail ||
        error?.message ||
        "Transaction failed.";

      setTxStatus(`Transaction failed: ${errorMessage}`);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Stellar Chapter Pay</h1>
        <p style={styles.subtitle}>
          A beginner-friendly Stellar dApp for chapter-based reading payments.
        </p>

        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Wallet Connection</h2>
          <p style={styles.text}>{walletStatus}</p>

          {walletAddress && (
            <div style={styles.infoBox}>
              <strong>Wallet Address:</strong>
              <p style={styles.addressText}>{walletAddress}</p>
            </div>
          )}

          {balance && (
            <div style={styles.infoBox}>
              <strong>XLM Balance:</strong>
              <p style={styles.balanceText}>{balance} XLM</p>
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
          <h2 style={styles.sectionTitle}>Send Testnet Payment</h2>

          <label style={styles.label}>Receiver Address</label>
          <input
            style={styles.input}
            type="text"
            placeholder="Enter Stellar testnet address"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
          />

          <label style={styles.label}>Amount (XLM)</label>
          <input
            style={styles.input}
            type="text"
            placeholder="Example: 0.5"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />

          <button style={styles.sendButton} onClick={handleSendPayment}>
            Pay for Chapter
          </button>

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
    maxWidth: "760px",
    backgroundColor: "#111827",
    color: "#f9fafb",
    borderRadius: "16px",
    padding: "32px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
  },
  title: {
    margin: "0 0 12px 0",
    fontSize: "36px",
    color: "#a78bfa",
    textAlign: "center",
  },
  subtitle: {
    margin: "0 0 24px 0",
    fontSize: "18px",
    color: "#d1d5db",
    textAlign: "center",
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
  addressText: {
    marginTop: "8px",
    fontSize: "14px",
    lineHeight: "1.6",
    color: "#93c5fd",
    wordBreak: "break-all",
  },
  balanceText: {
    marginTop: "8px",
    fontSize: "20px",
    fontWeight: "bold",
    color: "#34d399",
  },
  hashText: {
    marginTop: "8px",
    fontSize: "14px",
    lineHeight: "1.6",
    color: "#fca5a5",
    wordBreak: "break-all",
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
  label: {
    display: "block",
    marginTop: "14px",
    marginBottom: "8px",
    fontSize: "14px",
    color: "#d1d5db",
  },
  input: {
    width: "100%",
    padding: "12px",
    borderRadius: "10px",
    border: "1px solid #4b5563",
    backgroundColor: "#111827",
    color: "#f9fafb",
    fontSize: "14px",
    boxSizing: "border-box",
  },
  sendButton: {
    marginTop: "18px",
    backgroundColor: "#10b981",
    color: "white",
    border: "none",
    padding: "12px 18px",
    borderRadius: "10px",
    cursor: "pointer",
    fontSize: "15px",
    fontWeight: "bold",
    width: "100%",
  },
};

export default App;