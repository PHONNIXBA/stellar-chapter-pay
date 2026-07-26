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

  const normalizedNetwork =
    network.toUpperCase();

  return (
    normalizedNetwork ===
      STELLAR_NETWORK.name ||
    normalizedNetwork.includes(
      "TESTNET"
    )
  );
}

function readSelectedWalletModule() {
  const selectedModuleMember =
    StellarWalletsKit.selectedModule;

  if (
    typeof selectedModuleMember ===
    "function"
  ) {
    try {
      return (
        selectedModuleMember.call(
          StellarWalletsKit
        ) || null
      );
    } catch (error) {
      console.warn(
        "The Wallets Kit selected module could not be read:",
        error
      );

      return null;
    }
  }

  if (
    selectedModuleMember &&
    typeof selectedModuleMember ===
      "object"
  ) {
    return selectedModuleMember;
  }

  return null;
}

function getSelectedWalletDetails() {
  const selectedModule =
    readSelectedWalletModule();

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
    try {
      await StellarWalletsKit.disconnect();
    } catch (error) {
      console.warn(
        "Wallet cleanup after a network mismatch failed:",
        error
      );
    }

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
