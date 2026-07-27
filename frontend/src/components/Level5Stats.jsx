import "./Level5Stats.css";

import {
  formatLevel5UpdatedAt,
  normalizeLevel5Stats,
} from "../utils/level5Stats";

function Level5Stats({
  stats = null,
  isLoading = false,
  error = "",
}) {
  const normalizedStats =
    normalizeLevel5Stats(
      stats
    );

  const cards = [
    {
      label:
        "Registered wallets",

      value:
        normalizedStats.totalUsers,

      caption:
        "Wallet-only identities",
    },
    {
      label:
        "Active wallets",

      value:
        normalizedStats.activeUsers,

      caption:
        "Wallets with verified activity",
    },
    {
      label:
        "Interactions",

      value:
        normalizedStats
          .totalInteractions,

      caption:
        "Recorded product actions",
    },
    {
      label:
        "Successful transactions",

      value:
        normalizedStats
          .successfulTransactions,

      caption:
        "Confirmed Testnet actions",
    },
    {
      label:
        "Feedback responses",

      value:
        normalizedStats
          .feedbackCount,

      caption:
        "Wallet-linked reviews",
    },
    {
      label:
        "Average rating",

      value:
        normalizedStats
          .averageRating
          .toFixed(1),

      caption:
        "Rating out of 5",
    },
  ];

  return (
    <section
      className="level5-stats"
      aria-labelledby="level5-stats-title"
    >
      <div className="level5-stats-header">
        <div>
          <p className="level5-stats-kicker">
            Level 5 validation
          </p>

          <h2 id="level5-stats-title">
            Testnet product evidence
          </h2>

          <p className="level5-stats-description">
            Public wallet activity,
            successful transactions and
            wallet-linked product
            feedback recorded by the
            Chapter Pay backend.
          </p>
        </div>

        <span className="level5-stats-updated">
          Updated:{" "}
          {formatLevel5UpdatedAt(
            normalizedStats.updatedAt
          )}
        </span>
      </div>

      {isLoading && (
        <p
          className="level5-stats-message"
          role="status"
        >
          Loading Level 5 statistics...
        </p>
      )}

      {!isLoading && error && (
        <p
          className="level5-stats-message is-error"
          role="alert"
        >
          {error}
        </p>
      )}

      {!isLoading && !error && (
        <div className="level5-stats-grid">
          {cards.map((card) => (
            <article
              className="level5-stat-card"
              key={card.label}
            >
              <p>{card.label}</p>

              <strong>
                {card.value}
              </strong>

              <span>
                {card.caption}
              </span>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default Level5Stats;
