import {
  useEffect,
  useMemo,
  useState,
} from "react";

import "./Level5Dashboard.css";

import Level5Stats from "./Level5Stats";

import {
  fetchPublicEvidence,
} from "../services/api";

import {
  fetchLevel5Statistics,
} from "../services/statisticsApi";

import {
  STELLAR_NETWORK,
} from "../contractConfig";

const EMPTY_SUMMARY = Object.freeze({
  totalWallets: 0,
  verifiedWallets: 0,
  verifiedTransactions: 0,
  totalChapters: 0,
  totalAmount: 0,
  averageRating: 0,
});

function normalizeEvidence(payload) {
  const records =
    Array.isArray(payload?.records)
      ? payload.records
      : [];

  const sourceSummary =
    payload?.summary &&
    typeof payload.summary === "object"
      ? payload.summary
      : {};

  return {
    count:
      Number(payload?.count) ||
      records.length,

    summary: {
      totalWallets:
        Number(
          sourceSummary.totalWallets
        ) || 0,

      verifiedWallets:
        Number(
          sourceSummary.verifiedWallets
        ) || 0,

      verifiedTransactions:
        Number(
          sourceSummary
            .verifiedTransactions
        ) || 0,

      totalChapters:
        Number(
          sourceSummary.totalChapters
        ) || 0,

      totalAmount:
        Number(
          sourceSummary.totalAmount
        ) || 0,

      averageRating:
        Number(
          sourceSummary.averageRating
        ) || 0,
    },

    records,
  };
}

function toFiniteNumber(value) {
  const numberValue = Number(value);

  return Number.isFinite(numberValue)
    ? numberValue
    : 0;
}

function normalizeRating(value) {
  const rating = Number(value);

  if (
    !Number.isInteger(rating) ||
    rating < 1 ||
    rating > 5
  ) {
    return null;
  }

  return rating;
}

function formatMetric(value) {
  return toFiniteNumber(value)
    .toLocaleString(
      "en-US",
      {
        maximumFractionDigits: 2,
      }
    );
}

function formatAction(value) {
  const action = String(
    value || ""
  )
    .trim()
    .replace(
      /[_-]+/g,
      " "
    );

  if (!action) {
    return "On-chain interaction";
  }

  return action.replace(
    /\b\w/g,
    (character) =>
      character.toUpperCase()
  );
}

function shortenValue(
  value,
  start = 10,
  end = 8
) {
  if (!value) {
    return "—";
  }

  const text = String(value);

  if (
    text.length <=
    start + end + 3
  ) {
    return text;
  }

  return (
    `${text.slice(0, start)}` +
    "..." +
    `${text.slice(-end)}`
  );
}

function createExplorerUrl(
  type,
  value
) {
  if (!value) {
    return "";
  }

  const baseUrl =
    STELLAR_NETWORK
      .explorerBaseUrl ||
    "https://stellar.expert/explorer/testnet";

  const encodedValue =
    encodeURIComponent(value);

  if (type === "wallet") {
    return (
      `${baseUrl}/account/` +
      encodedValue
    );
  }

  if (type === "contract") {
    return (
      `${baseUrl}/contract/` +
      encodedValue
    );
  }

  if (type === "transaction") {
    return (
      `${baseUrl}/tx/` +
      encodedValue
    );
  }

  return "";
}

function formatRating(rating) {
  const normalizedRating =
    normalizeRating(rating);

  if (!normalizedRating) {
    return "—";
  }

  return (
    "\u2605".repeat(
      normalizedRating
    ) +
    "\u2606".repeat(
      5 - normalizedRating
    )
  );
}

function groupEvidenceByWallet(
  records
) {
  const walletMap = new Map();

  records.forEach(
    (
      record,
      recordIndex
    ) => {
      const walletAddress =
        String(
          record?.walletAddress || ""
        )
          .trim()
          .toUpperCase();

      const walletKey =
        walletAddress ||
        `unknown-wallet-${recordIndex}`;

      let wallet =
        walletMap.get(walletKey);

      if (!wallet) {
        wallet = {
          walletAddress,
          verification: "Pending",
          network:
            String(
              record?.network ||
                "TESTNET"
            ).toUpperCase(),

          rating: null,
          feedback: "",
          totalChapters: 0,
          totalAmount: 0,
          transactions: [],
          transactionHashes:
            new Set(),
        };

        walletMap.set(
          walletKey,
          wallet
        );
      }

      const feedback =
        String(
          record?.feedback || ""
        ).trim();

      if (
        !wallet.feedback &&
        feedback
      ) {
        wallet.feedback =
          feedback;
      }

      const rating =
        normalizeRating(
          record?.rating
        );

      if (
        wallet.rating === null &&
        rating !== null
      ) {
        wallet.rating =
          rating;
      }

      if (record?.network) {
        wallet.network =
          String(
            record.network
          ).toUpperCase();
      }

      const contractId =
        String(
          record?.contractId || ""
        ).trim();

      const transactionHash =
        String(
          record?.transactionHash || ""
        ).trim();

      const isVerified =
        String(
          record?.verification || ""
        ).toLowerCase() ===
        "verified";

      const hasVerifiedTransaction =
        isVerified &&
        Boolean(contractId) &&
        Boolean(transactionHash);

      if (
        !hasVerifiedTransaction ||
        wallet.transactionHashes.has(
          transactionHash
        )
      ) {
        return;
      }

      wallet.transactionHashes.add(
        transactionHash
      );

      const chaptersUnlocked =
        toFiniteNumber(
          record?.chaptersUnlocked
        );

      const amount =
        toFiniteNumber(
          record?.amount
        );

      wallet.transactions.push({
        action:
          String(
            record?.action || ""
          ).trim(),

        contractFunction:
          String(
            record?.contractFunction ||
              ""
          ).trim(),

        contractId,
        transactionHash,
        chaptersUnlocked,
        amount,
        verification: "Verified",
      });

      wallet.totalChapters +=
        chaptersUnlocked;

      wallet.totalAmount += amount;
      wallet.verification =
        "Verified";
    }
  );

  return Array.from(
    walletMap.values()
  ).map((wallet) => {
    const {
      transactionHashes,
      ...publicWallet
    } = wallet;

    void transactionHashes;

    return publicWallet;
  });
}

function matchesWalletSearch(
  wallet,
  searchTerm
) {
  if (!searchTerm) {
    return true;
  }

  const transactionText =
    wallet.transactions
      .flatMap(
        (transaction) => [
          transaction.action,
          transaction.contractFunction,
          transaction.contractId,
          transaction.transactionHash,
          transaction.chaptersUnlocked,
          transaction.amount,
        ]
      );

  const searchableText = [
    wallet.walletAddress,
    wallet.feedback,
    wallet.rating,
    wallet.verification,
    wallet.network,
    ...transactionText,
  ]
    .map((value) =>
      String(value || "")
        .toLowerCase()
    )
    .join(" ");

  return searchableText.includes(
    searchTerm
  );
}

function EvidenceIdentifierCell({
  type,
  value,
  label,
  onCopy,
}) {
  const explorerUrl =
    createExplorerUrl(
      type,
      value
    );

  if (!value) {
    return (
      <span className="evidence-empty-value">
        —
      </span>
    );
  }

  return (
    <div className="evidence-id-cell">
      {explorerUrl ? (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noreferrer"
          title={value}
        >
          {shortenValue(
            value,
            12,
            9
          )}
        </a>
      ) : (
        <span title={value}>
          {shortenValue(
            value,
            12,
            9
          )}
        </span>
      )}

      <button
        type="button"
        onClick={() => {
          void onCopy(
            value,
            label
          );
        }}
      >
        Copy
      </button>
    </div>
  );
}

function Level5Dashboard() {
  const [
    statistics,
    setStatistics,
  ] = useState(null);

  const [
    evidence,
    setEvidence,
  ] = useState({
    count: 0,
    summary: EMPTY_SUMMARY,
    records: [],
  });

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    searchValue,
    setSearchValue,
  ] = useState("");

  const [
    rateFilter,
    setRateFilter,
  ] = useState("all");

  const [
    verificationFilter,
    setVerificationFilter,
  ] = useState("all");

  const [
    copyMessage,
    setCopyMessage,
  ] = useState("");

  const walletGroups =
    useMemo(
      () =>
        groupEvidenceByWallet(
          evidence.records
        ),
      [evidence.records]
    );

  const filteredWallets =
    useMemo(() => {
      const normalizedSearch =
        searchValue
          .trim()
          .toLowerCase();

      return walletGroups.filter(
        (wallet) => {
          const searchMatches =
            matchesWalletSearch(
              wallet,
              normalizedSearch
            );

          const ratingMatches =
            rateFilter === "all" ||
            Number(wallet.rating) ===
              Number(rateFilter);

          const verificationMatches =
            verificationFilter ===
              "all" ||
            String(
              wallet.verification
            ).toLowerCase() ===
              verificationFilter;

          return (
            searchMatches &&
            ratingMatches &&
            verificationMatches
          );
        }
      );
    }, [
      rateFilter,
      searchValue,
      verificationFilter,
      walletGroups,
    ]);

  useEffect(() => {
    const controller =
      new AbortController();

    Promise.allSettled([
      fetchLevel5Statistics({
        signal:
          controller.signal,
      }),

      fetchPublicEvidence({
        signal:
          controller.signal,
      }),
    ])
      .then(
        ([
          statisticsResult,
          evidenceResult,
        ]) => {
          if (
            controller.signal.aborted
          ) {
            return;
          }

          const errorMessages = [];

          if (
            statisticsResult.status ===
            "fulfilled"
          ) {
            setStatistics(
              statisticsResult.value
            );
          }
          else {
            errorMessages.push(
              statisticsResult.reason
                instanceof Error
                ? statisticsResult
                    .reason.message
                : "Statistics could not be loaded."
            );
          }

          if (
            evidenceResult.status ===
            "fulfilled"
          ) {
            setEvidence(
              normalizeEvidence(
                evidenceResult.value
              )
            );
          }
          else {
            errorMessages.push(
              evidenceResult.reason
                instanceof Error
                ? evidenceResult
                    .reason.message
                : "Public evidence could not be loaded."
            );
          }

          setError(
            errorMessages.join(" ")
          );

          setIsLoading(false);
        }
      )
      .catch(
        (requestError) => {
          if (
            controller.signal.aborted
          ) {
            return;
          }

          setError(
            requestError instanceof Error
              ? requestError.message
              : "Public evidence could not be loaded."
          );

          setIsLoading(false);
        }
      );

    return () => {
      controller.abort();
    };
  }, []);
async function handleRefresh() {
    setIsLoading(true);
    setError("");
    setCopyMessage("");

    try {
      const [
        statisticsResult,
        evidenceResult,
      ] =
        await Promise.allSettled([
          fetchLevel5Statistics(),
          fetchPublicEvidence(),
        ]);

      const errorMessages = [];

      if (
        statisticsResult.status ===
        "fulfilled"
      ) {
        setStatistics(
          statisticsResult.value
        );
      }
      else {
        errorMessages.push(
          statisticsResult.reason
            instanceof Error
            ? statisticsResult
                .reason.message
            : "Statistics could not be loaded."
        );
      }

      if (
        evidenceResult.status ===
        "fulfilled"
      ) {
        setEvidence(
          normalizeEvidence(
            evidenceResult.value
          )
        );
      }
      else {
        errorMessages.push(
          evidenceResult.reason
            instanceof Error
            ? evidenceResult
                .reason.message
            : "Public evidence could not be loaded."
        );
      }

      setError(
        errorMessages.join(" ")
      );
    }
    catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Public evidence could not be loaded."
      );
    }
    finally {
      setIsLoading(false);
    }
  }

  async function handleCopy(
    value,
    label
  ) {
    if (!value) {
      return;
    }

    try {
      await navigator.clipboard
        .writeText(value);

      setCopyMessage(
        `${label} copied.`
      );
    }
    catch {
      setCopyMessage(
        `${label} could not be copied.`
      );
    }
  }

  function resetFilters() {
    setSearchValue("");
    setRateFilter("all");
    setVerificationFilter("all");
  }

  return (
    <div className="level5-dashboard">
      <div className="level5-dashboard-toolbar">
        <div>
          <strong>
            Public wallet evidence
          </strong>

          <p>
            One public card per wallet,
            with verified transactions
            grouped inside.
          </p>
        </div>

        <div className="level5-toolbar-actions">
          <button
            type="button"
            disabled={isLoading}
            onClick={handleRefresh}
          >
            {isLoading
              ? "Loading..."
              : "Refresh evidence"}
          </button>
        </div>
      </div>

      <Level5Stats
        stats={statistics}
        isLoading={isLoading}
        error={error}
      />

      <section
        className="evidence-sheet"
        aria-labelledby="evidence-sheet-title"
      >
        <div className="evidence-sheet-header">
          <div>
            <p className="evidence-sheet-kicker">
              PUBLIC TESTNET RECORDS
            </p>

            <h2 id="evidence-sheet-title">
              Wallet evidence cards
            </h2>

            <p>
              Each wallet appears once.
              Verified on-chain
              transactions are grouped
              inside its card. No names,
              emails or personal profile
              fields are displayed.
            </p>
          </div>

          <span className="evidence-record-count">
            {filteredWallets.length} of{" "}
            {walletGroups.length} wallets
          </span>
        </div>

        <div className="evidence-summary-grid">
          <article>
            <span>Total wallets</span>

            <strong>
              {
                evidence.summary
                  .totalWallets
              }
            </strong>
          </article>

          <article>
            <span>
              Verified wallets
            </span>

            <strong>
              {
                evidence.summary
                  .verifiedWallets
              }
            </strong>
          </article>

          <article>
            <span>
              Verified transactions
            </span>

            <strong>
              {
                evidence.summary
                  .verifiedTransactions
              }
            </strong>
          </article>

          <article>
            <span>Total chapters</span>

            <strong>
              {
                evidence.summary
                  .totalChapters
              }
            </strong>
          </article>

          <article>
            <span>Total amount</span>

            <strong>
              {
                evidence.summary
                  .totalAmount
              }
            </strong>
          </article>

          <article>
            <span>Average rate</span>

            <strong>
              {
                evidence.summary
                  .averageRating
                  .toFixed(1)
              }
            </strong>
          </article>
        </div>

        <div className="evidence-filters">
          <label className="evidence-search-field">
            <span>
              Search evidence
            </span>

            <input
              type="search"
              value={searchValue}
              placeholder="Wallet, contract, hash, action or feedback"
              onChange={(event) => {
                setSearchValue(
                  event.target.value
                );
              }}
            />
          </label>

          <label>
            <span>Rate</span>

            <select
              value={rateFilter}
              onChange={(event) => {
                setRateFilter(
                  event.target.value
                );
              }}
            >
              <option value="all">
                All rates
              </option>

              <option value="5">
                5 stars
              </option>

              <option value="4">
                4 stars
              </option>

              <option value="3">
                3 stars
              </option>

              <option value="2">
                2 stars
              </option>

              <option value="1">
                1 star
              </option>
            </select>
          </label>

          <label>
            <span>Verification</span>

            <select
              value={
                verificationFilter
              }
              onChange={(event) => {
                setVerificationFilter(
                  event.target.value
                );
              }}
            >
              <option value="all">
                All wallets
              </option>

              <option value="verified">
                Verified
              </option>

              <option value="pending">
                Pending
              </option>
            </select>
          </label>

          <button
            type="button"
            className="evidence-reset-button"
            onClick={resetFilters}
          >
            Reset filters
          </button>
        </div>

        {copyMessage && (
          <p
            className="evidence-copy-message"
            role="status"
            aria-live="polite"
          >
            {copyMessage}
          </p>
        )}

        {isLoading && (
          <div
            className="evidence-state"
            role="status"
          >
            Loading public evidence...
          </div>
        )}

        {!isLoading &&
          error &&
          walletGroups.length === 0 && (
            <div
              className="evidence-state is-error"
              role="alert"
            >
              {error}
            </div>
          )}

        {!isLoading &&
          filteredWallets.length === 0 &&
          !error && (
            <div className="evidence-state">
              No wallet evidence matches
              the selected filters.
            </div>
          )}

        {!isLoading &&
          filteredWallets.length > 0 && (
            <div className="wallet-evidence-list">
              {filteredWallets.map(
                (
                  wallet,
                  walletIndex
                ) => (
                  <article
                    className="wallet-evidence-card"
                    key={
                      wallet.walletAddress ||
                      String(walletIndex)
                    }
                  >
                    <header className="wallet-card-header">
                      <div className="wallet-card-identity">
                        <span className="wallet-card-number">
                          {walletIndex + 1}
                        </span>

                        <div>
                          <span className="wallet-card-label">
                            Wallet address
                          </span>

                          <EvidenceIdentifierCell
                            type="wallet"
                            value={
                              wallet.walletAddress
                            }
                            label="Wallet"
                            onCopy={
                              handleCopy
                            }
                          />
                        </div>
                      </div>

                      <div className="wallet-card-badges">
                        <span
                          className={
                            wallet.verification ===
                            "Verified"
                              ? "evidence-status is-verified"
                              : "evidence-status is-pending"
                          }
                        >
                          {
                            wallet.verification
                          }
                        </span>

                        <span className="evidence-network">
                          {wallet.network}
                        </span>
                      </div>
                    </header>

                    <div className="wallet-card-metrics">
                      <div>
                        <span>
                          Transactions
                        </span>

                        <strong>
                          {
                            wallet
                              .transactions
                              .length
                          }
                        </strong>
                      </div>

                      <div>
                        <span>
                          Chapters
                        </span>

                        <strong>
                          {formatMetric(
                            wallet
                              .totalChapters
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>Amount</span>

                        <strong>
                          {formatMetric(
                            wallet
                              .totalAmount
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>Rating</span>

                        <strong
                          className="evidence-rating"
                          title={
                            wallet.rating
                              ? `${wallet.rating} out of 5`
                              : "No rating"
                          }
                        >
                          {formatRating(
                            wallet.rating
                          )}
                        </strong>
                      </div>
                    </div>

                    <section className="wallet-feedback-panel">
                      <span>
                        Latest feedback
                      </span>

                      <p>
                        {wallet.feedback ||
                          "No feedback has been submitted for this wallet."}
                      </p>
                    </section>

                    <section className="wallet-transactions">
                      <div className="wallet-transactions-header">
                        <div>
                          <span>
                            Verified on-chain
                            activity
                          </span>

                          <p>
                            Contract IDs and
                            transaction hashes
                            open in Stellar
                            Expert.
                          </p>
                        </div>

                        <strong>
                          {
                            wallet
                              .transactions
                              .length
                          }
                        </strong>
                      </div>

                      {wallet.transactions
                        .length === 0 ? (
                        <div className="wallet-no-transactions">
                          No verified on-chain
                          transaction has been
                          recorded for this
                          wallet yet.
                        </div>
                      ) : (
                        <div className="wallet-transaction-list">
                          {wallet.transactions.map(
                            (
                              transaction,
                              transactionIndex
                            ) => (
                              <article
                                className="wallet-transaction-card"
                                key={
                                  transaction
                                    .transactionHash ||
                                  String(
                                    transactionIndex
                                  )
                                }
                              >
                                <div className="transaction-card-heading">
                                  <div>
                                    <span className="transaction-number">
                                      Transaction{" "}
                                      {
                                        transactionIndex +
                                        1
                                      }
                                    </span>

                                    <h3>
                                      {formatAction(
                                        transaction
                                          .action
                                      )}
                                    </h3>
                                  </div>

                                  <span className="transaction-verified">
                                    Verified
                                  </span>
                                </div>

                                {transaction
                                  .contractFunction && (
                                  <p className="transaction-function">
                                    Function:{" "}
                                    <code>
                                      {
                                        transaction
                                          .contractFunction
                                      }
                                    </code>
                                  </p>
                                )}

                                <div className="transaction-identifiers">
                                  <div>
                                    <span>
                                      Contract ID
                                    </span>

                                    <EvidenceIdentifierCell
                                      type="contract"
                                      value={
                                        transaction
                                          .contractId
                                      }
                                      label="Contract ID"
                                      onCopy={
                                        handleCopy
                                      }
                                    />
                                  </div>

                                  <div>
                                    <span>
                                      Transaction
                                      hash
                                    </span>

                                    <EvidenceIdentifierCell
                                      type="transaction"
                                      value={
                                        transaction
                                          .transactionHash
                                      }
                                      label="Transaction hash"
                                      onCopy={
                                        handleCopy
                                      }
                                    />
                                  </div>
                                </div>

                                <div className="transaction-metrics">
                                  <span>
                                    Chapters:{" "}
                                    <strong>
                                      {formatMetric(
                                        transaction
                                          .chaptersUnlocked
                                      )}
                                    </strong>
                                  </span>

                                  <span>
                                    Amount:{" "}
                                    <strong>
                                      {formatMetric(
                                        transaction
                                          .amount
                                      )}
                                    </strong>
                                  </span>
                                </div>
                              </article>
                            )
                          )}
                        </div>
                      )}
                    </section>
                  </article>
                )
              )}
            </div>
          )}
      </section>
    </div>
  );
}

export default Level5Dashboard;
