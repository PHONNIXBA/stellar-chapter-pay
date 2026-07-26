# Level 5 Implementation

## Overview

Stellar Chapter Pay is a Stellar Testnet application for purchasing access to multiple digital chapters with Chapter Coin.

The Level 5 upgrade extends the Level 4 Soroban product with persistent user onboarding, wallet activity tracking, product feedback, live validation statistics, protected exports, security controls, automated verification, and deployment readiness.

## Technical Status

The technical Level 5 infrastructure is implemented.

Completed areas:

- Soroban Chapter Token contract.
- Soroban Chapter Payment contract.
- Freighter wallet connection.
- Stellar Testnet validation.
- One-time Chapter Coin faucet.
- Multi-chapter payment transactions.
- Transaction status, hash, and explorer link.
- User onboarding linked to Stellar wallet addresses.
- PostgreSQL persistence.
- Wallet interaction tracking.
- Testnet transaction activity tracking.
- User rating and product feedback collection.
- Live Level 5 statistics dashboard.
- Excel-compatible CSV export.
- Protected private admin endpoints.
- Automated contract, backend, and frontend verification.
- GitHub Actions Level 5 workflow.

## Smart Contracts

### Chapter Token

The Chapter Token contract supports:

- Token initialization.
- Administrator authorization.
- Token metadata.
- Administrator minting.
- Token balance reads.
- Token transfers.
- One-time Testnet faucet claims.
- Total supply statistics.
- Typed Soroban events.

### Chapter Payment

The Chapter Payment contract supports:

- Administrator initialization.
- Chapter Token contract configuration.
- Chapter pricing.
- Multi-chapter purchases.
- Inter-contract token transfers.
- Persistent payment records.
- Per-wallet chapter access counts.
- Aggregate payment statistics.
- Price updates.
- Pause and resume controls.
- Typed Soroban events.

## Deployed Testnet Contracts

Chapter Payment:

    CD4Q4QQRSLMXOZCUE72OAXLKA5XBGAEO4G4O37BF4QIMOY7GQUHTAE2O

Chapter Token:

    CD4IL6YDYQRRLH5RKJCQ2D4XGQWJSLSOKBTGL6UE6VLBBL4I4EWEXTNR

Network:

    Stellar Testnet

## User Flow

A complete product flow is:

1. Open the deployed frontend.
2. Connect Freighter.
3. Confirm Freighter is using Stellar Testnet.
4. Complete the onboarding profile.
5. Claim demo Chapter Coin.
6. Select the number of chapters.
7. Sign the chapter purchase transaction.
8. Wait for transaction confirmation.
9. View the transaction hash and explorer link.
10. Submit a rating and product feedback.
11. View aggregated evidence in the Level 5 dashboard.

## Persistent Data

The backend uses PostgreSQL in production.

### Users

The users table stores:

- User ID.
- Name.
- Email.
- Stellar wallet address.
- Onboarding status.
- Onboarding completion state.
- Join time.
- Last active time.
- Created and updated timestamps.

### Interactions

The interactions table stores:

- User and wallet association.
- Product action.
- Contract function.
- Pending, success, or failed status.
- Testnet transaction hash.
- Stellar network.
- Additional metadata.
- Creation timestamp.

### Feedback

The feedback table stores:

- User and wallet association.
- Rating from 1 to 5.
- Written feedback.
- Improvement category.
- Creation timestamp.

## Level 5 Statistics

The public statistics endpoint is:

    GET /api/statistics/level-5

It reports:

- Registered users.
- Active wallets.
- Recorded interactions.
- Successful Testnet transactions.
- Feedback responses.
- Average rating.
- Last update time.

The frontend displays these values through the Testnet Product Evidence dashboard.

## Data Export

The protected export endpoint is:

    GET /api/exports/level-5.csv

Required header:

    x-export-api-key

The export is compatible with Excel and includes:

- Users.
- Wallet addresses.
- Onboarding information.
- Interactions.
- Transaction hashes.
- Feedback.
- Ratings.
- Improvement categories.

## Security

Private list endpoints require:

    x-admin-api-key

Protected endpoints:

    GET /api/users
    GET /api/interactions
    GET /api/feedback

Production startup requires:

- DATABASE_URL.
- ADMIN_API_KEY.

The export service separately requires:

- EXPORT_API_KEY.

API keys are compared with constant-time comparison.

Private environment files must never be committed.

## Automated Verification

Run from the repository root:

    Set-Location "D:\StellarBuilds\stellar-chapter-pay"

    powershell.exe `
        -NoProfile `
        -ExecutionPolicy Bypass `
        -File ".\scripts\verify-level5.ps1" `
        -SkipInstall

The verifier checks:

- Required repository files.
- Level 5 frontend integration.
- PostgreSQL schema.
- Admin endpoint security.
- Minimum commit count.
- Private environment file tracking.
- Contract formatting.
- Contract WASM checks.
- Fourteen contract tests.
- Contract release builds.
- Backend type-check, tests, build, and audit.
- Frontend lint, tests, build, and audit.
- Git formatting.

Expected result:

    LEVEL 5 TECHNICAL VERIFICATION PASSED

## Real-User Validation Status

Technical support for real-user validation is complete.

The following evidence must still be collected separately before a final Level 5 submission:

- At least 50 genuine Testnet users.
- Distinct real wallet addresses.
- Genuine Testnet transaction hashes.
- Google Form responses.
- Exported Excel or Google Sheet evidence.
- Product improvements based on feedback.
- Improvement commit links.
- Final analytics screenshots.
- Professional pitch deck.
- Complete product walkthrough video.

Local smoke-test users and manually inserted test records must not be counted as real-user evidence.

## Evidence Principle

Evidence must represent genuine user activity.

Do not:

- Create fake users.
- Duplicate one person across many wallets.
- Insert fabricated transaction hashes.
- Count local smoke-test data.
- Present generated test records as product traction.

The user-validation phase will be completed separately after deployment.
