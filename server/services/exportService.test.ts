import {
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  clearDataForTests,
  createFeedback,
  createInteraction,
} from "./dataService";

import {
  buildPublicEvidence,
  resolveEvidenceContractId,
} from "./exportService";

import {
  clearUsersForTests,
  registerUser,
} from "./userService";

const WALLET_A =
  `G${"D".repeat(55)}`;

const WALLET_B =
  `G${"E".repeat(55)}`;

const PAYMENT_CONTRACT =
  `C${"F".repeat(55)}`;

const TOKEN_CONTRACT =
  `C${"G".repeat(55)}`;

describe(
  "public evidence export",
  () => {
    beforeEach(() => {
      delete process.env
        .DATABASE_URL;

      delete process.env
        .POSTGRES_URL;

      process.env
        .STELLAR_NETWORK =
        "TESTNET";

      process.env
        .CHAPTER_PAYMENT_CONTRACT_ID =
        PAYMENT_CONTRACT;

      process.env
        .CHAPTER_TOKEN_CONTRACT_ID =
        TOKEN_CONTRACT;

      clearDataForTests();
      clearUsersForTests();
    });

    it(
      "returns one row for each successful transaction",
      async () => {
        await registerUser({
          walletAddress:
            WALLET_A,
        });

        await createInteraction({
          walletAddress:
            WALLET_A,

          action:
            "demo_coins_claimed",

          contractId:
            TOKEN_CONTRACT,

          contractFunction:
            "faucet",

          status:
            "success",

          txHash:
            "token-hash-a",

          network:
            "TESTNET",
        });

        await createInteraction({
          walletAddress:
            WALLET_A,

          action:
            "chapters_unlocked",

          contractId:
            PAYMENT_CONTRACT,

          contractFunction:
            "unlock_with_payment",

          status:
            "success",

          txHash:
            "payment-hash-a",

          network:
            "TESTNET",

          metadata: {
            quantity: 3,
            totalPrice: 15,
          },
        });

        await createFeedback({
          walletAddress:
            WALLET_A,

          rating: 5,

          comment:
            "The chapter payment flow worked.",
        });

        const evidence =
          await buildPublicEvidence();

        expect(
          evidence.records
        ).toHaveLength(2);

        const tokenRecord =
          evidence.records.find(
            (record) =>
              record.contractId ===
              TOKEN_CONTRACT
          );

        const paymentRecord =
          evidence.records.find(
            (record) =>
              record.contractId ===
              PAYMENT_CONTRACT
          );

        expect(
          tokenRecord
        ).toMatchObject({
          walletAddress:
            WALLET_A,

          action:
            "demo_coins_claimed",

          contractFunction:
            "faucet",

          transactionHash:
            "token-hash-a",

          chaptersUnlocked: 0,
          amount: 0,

          verification:
            "Verified",
        });

        expect(
          paymentRecord
        ).toMatchObject({
          walletAddress:
            WALLET_A,

          action:
            "chapters_unlocked",

          contractFunction:
            "unlock_with_payment",

          transactionHash:
            "payment-hash-a",

          chaptersUnlocked: 3,
          amount: 15,
          rating: 5,

          verification:
            "Verified",
        });

        expect(
          evidence.summary
        ).toEqual({
          totalWallets: 1,
          verifiedWallets: 1,
          verifiedTransactions: 2,
          totalChapters: 3,
          totalAmount: 15,
          averageRating: 5,
        });
      }
    );

    it(
      "keeps contract and hash empty for a wallet without a transaction",
      async () => {
        await registerUser({
          walletAddress:
            WALLET_B,
        });

        const evidence =
          await buildPublicEvidence();

        expect(
          evidence.records
        ).toHaveLength(1);

        expect(
          evidence.records[0]
        ).toMatchObject({
          walletAddress:
            WALLET_B,

          action: "",
          contractId: "",
          contractFunction: "",
          transactionHash: "",

          chaptersUnlocked: 0,
          amount: 0,

          verification:
            "Pending",
        });

        expect(
          evidence.summary
        ).toMatchObject({
          totalWallets: 1,
          verifiedWallets: 0,
          verifiedTransactions: 0,
        });
      }
    );

    it(
      "supports different chapter quantities on the same payment contract",
      async () => {
        await createInteraction({
          walletAddress:
            WALLET_A,

          action:
            "chapters_unlocked",

          contractId:
            PAYMENT_CONTRACT,

          contractFunction:
            "unlock_with_payment",

          status:
            "success",

          txHash:
            "wallet-a-payment",

          network:
            "TESTNET",

          metadata: {
            quantity: 1,
            totalPrice: 5,
          },
        });

        await createInteraction({
          walletAddress:
            WALLET_B,

          action:
            "chapters_unlocked",

          contractId:
            PAYMENT_CONTRACT,

          contractFunction:
            "unlock_with_payment",

          status:
            "success",

          txHash:
            "wallet-b-payment",

          network:
            "TESTNET",

          metadata: {
            quantity: 4,
            totalPrice: 20,
          },
        });

        const evidence =
          await buildPublicEvidence();

        expect(
          evidence.records
        ).toHaveLength(2);

        expect(
          new Set(
            evidence.records.map(
              (record) =>
                record.contractId
            )
          )
        ).toEqual(
          new Set([
            PAYMENT_CONTRACT,
          ])
        );

        expect(
          evidence.records.find(
            (record) =>
              record.walletAddress ===
              WALLET_A
          )
        ).toMatchObject({
          action:
            "chapters_unlocked",

          contractFunction:
            "unlock_with_payment",

          chaptersUnlocked: 1,
          amount: 5,

          transactionHash:
            "wallet-a-payment",
        });

        expect(
          evidence.records.find(
            (record) =>
              record.walletAddress ===
              WALLET_B
          )
        ).toMatchObject({
          action:
            "chapters_unlocked",

          contractFunction:
            "unlock_with_payment",

          chaptersUnlocked: 4,
          amount: 20,

          transactionHash:
            "wallet-b-payment",
        });

        expect(
          evidence.summary
        ).toMatchObject({
          totalWallets: 2,
          verifiedWallets: 2,
          verifiedTransactions: 2,
          totalChapters: 5,
          totalAmount: 25,
        });
      }
    );

    it(
      "infers only known legacy contract actions",
      () => {
        expect(
          resolveEvidenceContractId({
            action:
              "demo_coins_claimed",

            contractFunction:
              "faucet",
          })
        ).toBe(
          TOKEN_CONTRACT
        );

        expect(
          resolveEvidenceContractId({
            action:
              "chapters_unlocked",

            contractFunction:
              "unlock_with_payment",
          })
        ).toBe(
          PAYMENT_CONTRACT
        );

        expect(
          resolveEvidenceContractId({
            action:
              "wallet_connected",
          })
        ).toBe("");
      }
    );
  }
);
