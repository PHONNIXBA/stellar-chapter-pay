import "./EvidencePage.css";

import Level5Dashboard from "./Level5Dashboard";

function EvidencePage() {
  return (
    <main className="evidence-page">
      <header className="evidence-page-header">
        <div className="evidence-page-navigation">
          <span className="evidence-page-badge">
            Stellar Testnet
          </span>
        </div>

        <div className="evidence-page-introduction">
          <p className="evidence-page-kicker">
            PUBLIC PRODUCT VALIDATION
          </p>

          <h1>
            Chapter Pay Evidence
          </h1>

          <p>
            Public wallet activity,
            confirmed Testnet transactions
            and wallet-linked product
            feedback for independent
            verification.
          </p>
        </div>

        <div className="evidence-page-notice">
          <strong>
            Privacy notice
          </strong>

          <p>
            This page contains wallet
            addresses and public Testnet
            evidence only. Names and email
            addresses are not collected.
          </p>
        </div>
      </header>

      <Level5Dashboard />

      <footer className="evidence-page-footer">
        <p>
          Evidence generated from Chapter
          Pay wallet activity on Stellar
          Testnet.
        </p>

        <a href="/">
          Return to the application
        </a>
      </footer>
    </main>
  );
}

export default EvidencePage;
