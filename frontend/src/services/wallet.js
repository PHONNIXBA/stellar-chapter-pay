import {
  StellarWalletsKit,
} from "@creit-tech/stellar-wallets-kit/sdk";

import {
  defaultModules,
} from "@creit-tech/stellar-wallets-kit/modules/utils";

import {
  Networks,
} from "@creit-tech/stellar-wallets-kit/types";

import {
  STELLAR_NETWORK,
} from "../contractConfig";

let walletKitInitialized = false;

function ensureWalletKit() {
  if (!walletKitInitialized) {
    StellarWalletsKit.init({
      modules: defaultModules(),

      network: Networks.TESTNET,

      authModal: {
        showInstallLabel: true,
        hideUnsupportedWallets: false,
      },
    });

    walletKitInitialized = true;
    return;
  }

  StellarWalletsKit.setNetwork(
    Networks.TESTNET
  );
}

function isTestnetNetwork(
  networkDetails
) {
  const networkPassphrase = String(
    networkDetails?.networkPassphrase ||
      ""
  ).trim();

  if (networkPassphrase) {
    return (
      networkPassphrase ===
      STELLAR_NETWORK.networkPassphrase
    );
  }

  const network = String(
    networkDetails?.network || ""
  ).trim();

  if (!network) {
    return true;
  }

  if (
    network ===
    STELLAR_NETWORK.networkPassphrase
  ) {
    return true;
  }

  return (
    network.toUpperCase() ===
      STELLAR_NETWORK.name ||
    network
      .toUpperCase()
      .includes("TESTNET")
  );
}

function getSelectedWalletDetails() {
  const selectedModule =
    StellarWalletsKit.selectedModule();

  return {
    walletId:
      selectedModule?.productId || "",

    walletName:
      selectedModule?.productName ||
      "Stellar wallet",
  };
}

export function initializeWalletKit() {
  ensureWalletKit();
}

export async function connectWallet() {
  ensureWalletKit();

  const authenticationResult =
    await StellarWalletsKit.authModal();

  const address =
    authenticationResult?.address;

  if (!address) {
    throw new Error(
      "The selected wallet did not return an address."
    );
  }

  let networkDetails = null;

  try {
    networkDetails =
      await StellarWalletsKit.getNetwork();
  } catch (error) {
    console.warn(
      "The selected wallet did not report its active network:",
      error
    );
  }

  if (
    networkDetails &&
    !isTestnetNetwork(networkDetails)
  ) {
    await StellarWalletsKit
      .disconnect()
      .catch(() => {});

    throw new Error(
      "The selected wallet is not connected to Stellar Testnet."
    );
  }

  const walletDetails =
    getSelectedWalletDetails();

  return {
    address,
    ...walletDetails,
  };
}

export async function disconnectWallet() {
  ensureWalletKit();

  await StellarWalletsKit.disconnect();
}

export async function signWalletTransaction({
  transactionXdr,
  walletAddress,
}) {
  ensureWalletKit();

  if (!transactionXdr) {
    throw new Error(
      "A transaction XDR is required."
    );
  }

  if (!walletAddress) {
    throw new Error(
      "A wallet address is required."
    );
  }

  const activeAccount =
    await StellarWalletsKit.getAddress();

  if (
    activeAccount?.address &&
    activeAccount.address !==
      walletAddress
  ) {
    throw new Error(
      "The active wallet account changed. Reconnect the wallet and try again."
    );
  }

  const signedResult =
    await StellarWalletsKit
      .signTransaction(
        transactionXdr,
        {
          networkPassphrase:
            STELLAR_NETWORK
              .networkPassphrase,

          address: walletAddress,
        }
      );

  if (!signedResult?.signedTxXdr) {
    throw new Error(
      "Transaction signing was cancelled or rejected."
    );
  }

  return signedResult;
}
