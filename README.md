# Stellar Chapter Pay

Stellar Chapter Pay is a Stellar Testnet application for purchasing access to multiple digital chapters with Chapter Coin.

The project combines two Soroban smart contracts, Freighter wallet integration, a responsive React frontend, a TypeScript backend, PostgreSQL persistence, user onboarding, transaction tracking, product feedback, live usage statistics, protected data export, automated tests, CI/CD, and deployment configuration.

## Problem

Digital content platforms commonly depend on centralized payment and access databases.

This creates several limitations:

- Users cannot independently verify purchases.
- Payment records are controlled by one platform.
- Access history may be difficult to audit.
- Small content purchases may require multiple separate payments.
- Product operators may lack transparent usage evidence.

Stellar Chapter Pay demonstrates a transparent alternative where chapter payments and access records are processed through Soroban contracts on Stellar.

## Why Stellar

Stellar provides:

- Fast transaction settlement.
- Low transaction costs.
- Freighter wallet integration.
- Soroban smart contracts.
- Persistent on-chain storage.
- Typed contract events.
- Inter-contract communication.
- Public transaction verification.

The current deployment uses Stellar Testnet.

## Core Product Flow

1. Open the frontend.
2. Connect Freighter.
3. Confirm Freighter is using Stellar Testnet.
4. Register a profile linked to the wallet.
5. Claim demo Chapter Coin.
6. Select the number of chapters.
7. Sign one Soroban payment transaction.
8. Wait for transaction confirmation.
9. View the transaction hash and explorer link.
10. Submit a product rating and feedback.
11. View aggregated usage statistics.

## Main Features

### Chapter Coin

Users can:

- Claim a one-time Testnet token allocation.
- Read their Chapter Coin balance.
- Use Chapter Coin to purchase chapter access.

Administrators can:

- Initialize token metadata.
- Mint Chapter Coin.
- Read total supply statistics.

### Chapter Payments

Users can:

- Select a chapter quantity.
- See the estimated total payment.
- Unlock multiple chapters in one transaction.
- Read their unlocked chapter count.
- View pending, successful, failed, and timeout states.
- Copy the transaction hash.
- Open the transaction in Stellar Explorer.

Administrators can:

- Configure the token contract.
- Set or update the chapter price.
- Pause or resume chapter payments.
- Read aggregate payment statistics.

### User Onboarding

The application can:

- Register a name and email.
- Link the profile to a Stellar wallet.
- Track onboarding progress.
- Mark wallets active after successful Testnet activity.
- Load an existing profile after wallet connection.

### Activity Tracking

The backend records:

- Wallet connections.
- Profile registrations.
- Pending transactions.
- Successful transactions.
- Failed transactions.
- Contract functions.
- Transaction hashes.
- Network information.
- Product metadata.

Tracking failures do not interrupt Stellar transactions.

### Product Feedback

Registered users can submit:

- Rating from 1 to 5.
- Written feedback.
- Improvement category.
- Wallet-linked product validation information.

### Level 5 Statistics

The frontend displays live backend statistics:

- Registered users.
- Active wallets.
- Recorded interactions.
- Successful Testnet transactions.
- Feedback responses.
- Average rating.

Public endpoint:

    GET /api/statistics/level-5

### Data Export

The backend provides an Excel-compatible CSV export containing users, wallet activity, transaction hashes, and feedback.

Protected endpoint:

    GET /api/exports/level-5.csv

Required header:

    x-export-api-key

Exported personal data must not be committed to the public repository.

## Architecture

    Freighter Wallet
           |
           v
    React + Vite Frontend
           |
           +------------------------+
           |                        |
           v                        v
    Stellar RPC              Express API
           |                        |
           v                        v
    Chapter Payment            PostgreSQL
           |                  /     |      \
           v                 Users Activity Feedback
    Chapter Token
           |
           v
    Stellar Testnet

## Smart Contracts

### Chapter Token

The Chapter Token contract supports:

- Initialization.
- Administrator authorization.
- Token metadata.
- Administrator minting.
- Account balances.
- Token transfers.
- One-time faucet claims.
- Total supply statistics.
- Typed Soroban events.

### Chapter Payment

The Chapter Payment contract supports:

- Initialization.
- Token contract configuration.
- Chapter pricing.
- Multi-chapter purchases.
- Inter-contract token transfers.
- Persistent payment records.
- Per-wallet access counts.
- Aggregate statistics.
- Price updates.
- Pause and resume controls.
- Typed Soroban events.

## Testnet Contract IDs

Chapter Payment:

    CD4Q4QQRSLMXOZCUE72OAXLKA5XBGAEO4G4O37BF4QIMOY7GQUHTAE2O

Chapter Token:

    CD4IL6YDYQRRLH5RKJCQ2D4XGQWJSLSOKBTGL6UE6VLBBL4I4EWEXTNR

Runtime configuration:

    frontend/public/contracts.json

## Repository Structure

    stellar-chapter-pay
    |-- .github
    |   `-- workflows
    |       |-- ci.yml
    |       `-- level-5.yml
    |
    |-- contracts
    |   `-- chapter-unlock
    |       |-- contracts
    |       |   |-- chapter-payment
    |       |   `-- chapter-token
    |       |-- Cargo.toml
    |       `-- Cargo.lock
    |
    |-- frontend
    |   |-- public
    |   |   `-- contracts.json
    |   |-- src
    |   |   |-- components
    |   |   |-- services
    |   |   |-- utils
    |   |   |-- App.jsx
    |   |   `-- App.css
    |   |-- package.json
    |   `-- package-lock.json
    |
    |-- server
    |   |-- services
    |   |-- index.ts
    |   |-- index.test.ts
    |   |-- package.json
    |   `-- package-lock.json
    |
    |-- scripts
    |   |-- deploy-and-save.ps1
    |   |-- verify-level4.ps1
    |   `-- verify-level5.ps1
    |
    |-- docs
    |   |-- ARCHITECTURE.md
    |   |-- DEPLOYMENT.md
    |   |-- LEVEL5_IMPLEMENTATION.md
    |   `-- QUALITY_AND_DEPLOYMENT.md
    |
    |-- CONTRACT_ID.txt
    |-- Procfile
    |-- railway.toml
    |-- vercel.json
    `-- README.md

## Backend Endpoints

Public endpoints:

    GET  /health
    GET  /api/config
    GET  /api/functions
    GET  /api/users/:walletAddress
    POST /api/users
    POST /api/interactions
    POST /api/feedback
    GET  /api/analytics
    GET  /api/statistics/level-5
    GET  /api/product-readiness

Private list endpoints:

    GET /api/users
    GET /api/interactions
    GET /api/feedback

Private list endpoints require:

    x-admin-api-key

The CSV export requires:

    x-export-api-key

## Local Development

Requirements:

- Node.js 24 or newer.
- npm.
- Rust stable.
- Rust target `wasm32v1-none`.
- Stellar CLI.
- Freighter browser extension.

### Start the Backend

Open PowerShell:

    Set-Location "D:\StellarBuilds\stellar-chapter-pay\server"

    npm ci

    $env:PORT = "3001"
    $env:ADMIN_API_KEY = "local-admin-key"
    $env:EXPORT_API_KEY = "local-export-key"

    npm run dev

Without `DATABASE_URL`, local development uses temporary memory storage. Memory data is cleared when the backend restarts.

### Start the Frontend

Open another PowerShell window:

    Set-Location "D:\StellarBuilds\stellar-chapter-pay\frontend"

    npm ci

    $env:VITE_API_BASE_URL = "http://127.0.0.1:3001"

    npm run dev -- --host 127.0.0.1 --port 5173

Open:

    http://127.0.0.1:5173

## Environment Variables

Production backend variables:

    NODE_ENV=production
    DATABASE_URL=<postgresql-connection-string>
    ADMIN_API_KEY=<long-random-secret>
    EXPORT_API_KEY=<different-long-random-secret>
    CORS_ORIGIN=https://your-frontend-domain.example

Frontend variable:

    VITE_API_BASE_URL=https://your-backend-domain.example

Stellar backend configuration:

    STELLAR_NETWORK=TESTNET
    STELLAR_RPC_URL=https://soroban-testnet.stellar.org:443
    STELLAR_EXPLORER_URL=https://stellar.expert/explorer/testnet
    CHAPTER_PAYMENT_CONTRACT_ID=CD4Q4QQRSLMXOZCUE72OAXLKA5XBGAEO4G4O37BF4QIMOY7GQUHTAE2O
    CHAPTER_TOKEN_CONTRACT_ID=CD4IL6YDYQRRLH5RKJCQ2D4XGQWJSLSOKBTGL6UE6VLBBL4I4EWEXTNR

Do not commit secrets or local `.env` files.

## Technical Verification

Run from the repository root:

    Set-Location "D:\StellarBuilds\stellar-chapter-pay"

    powershell.exe `
        -NoProfile `
        -ExecutionPolicy Bypass `
        -File ".\scripts\verify-level5.ps1"

The verifier checks:

- Repository structure.
- Level 5 integrations.
- Contract formatting.
- Contract WASM checks.
- Fourteen contract tests.
- Contract release builds.
- Backend type-checking.
- Backend tests.
- Backend production build.
- Backend dependency audit.
- Frontend linting.
- Frontend tests.
- Frontend production build.
- Frontend dependency audit.
- Environment file protection.
- Minimum commit count.
- Git formatting.

Expected result:

    LEVEL 5 TECHNICAL VERIFICATION PASSED

## Continuous Integration

The Level 5 GitHub Actions workflow is:

    .github/workflows/level-5.yml

It verifies contracts, backend, frontend, security checks, and repository requirements.

## Deployment

Deployment documentation:

- [Deployment Guide](docs/DEPLOYMENT.md)
- [Level 5 Implementation](docs/LEVEL5_IMPLEMENTATION.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Quality and Deployment](docs/QUALITY_AND_DEPLOYMENT.md)

Recommended deployment order:

1. PostgreSQL.
2. Railway backend.
3. Vercel frontend.
4. End-to-end smoke test.

## Security

The project includes:

- Freighter authorization and transaction signing.
- Administrator-only contract functions.
- Checked contract arithmetic.
- Input validation.
- One-time faucet protection.
- PostgreSQL parameterized queries.
- Request body size limits.
- Protected private endpoints.
- Constant-time API key comparison.
- Separate admin and export secrets.
- Dependency security audits.
- Environment file protection.
- Generated file protection.

Never commit:

- `.env`
- `.env.local`
- `DATABASE_URL`
- `ADMIN_API_KEY`
- `EXPORT_API_KEY`
- wallet secret keys
- exported user data
- `node_modules`
- `dist`
- `target`

## Validation Status

The technical Level 5 infrastructure is implemented and locally verified.

Real-user evidence is a separate phase and has not been claimed in this repository. Local smoke-test data must not be counted as genuine product usage.

The later validation phase should collect genuine Stellar Testnet wallets, real transaction hashes, user feedback, exported evidence, analytics screenshots, product improvements, a pitch deck, and a complete walkthrough video.

## License

This repository is provided as a Stellar Testnet educational and product-validation project.
