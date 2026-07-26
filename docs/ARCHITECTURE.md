# Architecture

## Overview

Stellar Chapter Pay is a full-stack Stellar Testnet application for purchasing access to multiple digital chapters with Chapter Coin.

The Level 5 architecture combines:

- Two Soroban smart contracts.
- A React and Vite frontend.
- Freighter wallet integration.
- A TypeScript and Express backend.
- PostgreSQL persistence.
- User onboarding linked to Stellar wallets.
- Wallet and transaction activity tracking.
- Product feedback collection.
- Live product evidence statistics.
- Protected administrative endpoints.
- Excel-compatible CSV export.
- Automated local and GitHub Actions verification.

## High-Level Architecture

    User
      |
      v
    Browser
      |
      +---------------------------+
      |                           |
      v                           v
    Freighter Wallet       React + Vite Frontend
      |                           |
      |                           +----------------------+
      |                           |                      |
      v                           v                      v
    Stellar Testnet RPC     Express API          Local analytics cache
      |                           |
      v                           v
    Chapter Payment         PostgreSQL
      |                     /     |      \
      v                    Users  Activity Feedback
    Chapter Token

## Deployment Topology

Production deployment is separated into four components:

1. Chapter Token contract on Stellar Testnet.
2. Chapter Payment contract on Stellar Testnet.
3. Express backend and PostgreSQL database on Railway.
4. React frontend on Vercel.

The frontend communicates with:

- Freighter for wallet authorization and transaction signing.
- Stellar RPC for contract reads and transaction submission.
- The backend API for onboarding, activity tracking, feedback, statistics, and exports.

## Soroban Contracts

The contract workspace is located at:

    contracts/chapter-unlock

It contains:

    contracts/chapter-unlock/contracts/chapter-token
    contracts/chapter-unlock/contracts/chapter-payment

### Chapter Token Contract

Responsibilities:

- Initialize token metadata.
- Store the administrator address.
- Mint Chapter Coin.
- Read token balances.
- Transfer tokens.
- Provide a one-time Testnet faucet.
- Track total token supply.
- Publish typed Soroban events.

The faucet protects against repeated claims by the same wallet.

### Chapter Payment Contract

Responsibilities:

- Initialize payment configuration.
- Store the Chapter Token contract ID.
- Store the chapter price.
- Process multi-chapter purchases.
- Call the Chapter Token contract.
- Transfer Chapter Coin from buyer to administrator.
- Store payment records.
- Track unlocked chapter counts.
- Track aggregate payment statistics.
- Update chapter pricing.
- Pause and resume payments.
- Publish typed Soroban events.

### Inter-Contract Payment Flow

    User selects quantity
            |
            v
    Frontend calculates estimated total
            |
            v
    User signs unlock_with_payment
            |
            v
    Chapter Payment contract
            |
            v
    Chapter Token transfer
            |
            v
    Payment record and access count updated

## Testnet Contract IDs

Chapter Payment:

    CD4Q4QQRSLMXOZCUE72OAXLKA5XBGAEO4G4O37BF4QIMOY7GQUHTAE2O

Chapter Token:

    CD4IL6YDYQRRLH5RKJCQ2D4XGQWJSLSOKBTGL6UE6VLBBL4I4EWEXTNR

Runtime frontend configuration:

    frontend/public/contracts.json

## Frontend Architecture

The frontend is located at:

    frontend

Primary responsibilities:

- Connect and disconnect Freighter.
- Validate the Stellar network.
- Load deployed contract configuration.
- Read contract state.
- Submit signed Testnet transactions.
- Display transaction status and hash.
- Register wallet-linked user profiles.
- Send activity records to the backend.
- Collect product feedback.
- Display Level 5 statistics.

### Main Application

Primary entry:

    frontend/src/App.jsx

The application coordinates:

- Contract configuration.
- Wallet session state.
- Chapter Coin balance.
- Chapter access count.
- Chapter pricing.
- Claim transactions.
- Chapter purchase transactions.
- Local activity display.
- Remote activity persistence.
- Onboarding state.
- Feedback state.
- Level 5 evidence dashboard.

### Frontend Components

Onboarding:

    frontend/src/components/OnboardingForm.jsx

Feedback:

    frontend/src/components/FeedbackForm.jsx

Live statistics:

    frontend/src/components/Level5Dashboard.jsx
    frontend/src/components/Level5Stats.jsx

### Frontend Services

Backend API client:

    frontend/src/services/api.js

Remote interaction synchronization:

    frontend/src/services/activitySync.js

Statistics API client:

    frontend/src/services/statisticsApi.js

Soroban integration:

    frontend/src/services/contract.js

Local product analytics:

    frontend/src/services/analytics.js

### Transaction State

The frontend represents transaction activity with:

- Preparing.
- Pending.
- Successful.
- Failed.
- Confirmation timeout.

When a transaction is submitted, the frontend stores and displays its transaction hash.

Backend activity logging is non-blocking. A backend analytics failure does not cancel or invalidate the Stellar transaction.

## Backend Architecture

The backend is located at:

    server

Primary entry:

    server/index.ts

The backend uses:

- Express.
- TypeScript.
- PostgreSQL.
- Parameterized SQL queries.
- Environment-based configuration.
- Request validation.
- API key middleware.
- Automated tests.

### Public Endpoints

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

### Private Endpoints

These endpoints require:

    x-admin-api-key

Protected routes:

    GET /api/users
    GET /api/interactions
    GET /api/feedback

### Export Endpoint

The Level 5 CSV export requires:

    x-export-api-key

Endpoint:

    GET /api/exports/level-5.csv

Admin and export keys are separate secrets.

## Backend Services

Database configuration and schema:

    server/services/databaseService.ts

User registration and wallet mapping:

    server/services/userService.ts

Interactions, feedback, and analytics:

    server/services/dataService.ts

Level 5 aggregate statistics:

    server/services/statisticsService.ts

Private endpoint authorization:

    server/services/adminAuth.ts

Excel-compatible CSV export:

    server/services/exportService.ts

Contract and runtime information:

    server/services/contractService.ts

## PostgreSQL Data Model

### Users Table

The users table stores:

- ID.
- Name.
- Email.
- Wallet address.
- Onboarding status.
- Onboarding completion.
- Join timestamp.
- Last active timestamp.
- Created timestamp.
- Updated timestamp.

The wallet address is unique.

Supported onboarding states:

    registered
    wallet_connected
    funded
    active

### Interactions Table

The interactions table stores:

- ID.
- Optional linked user ID.
- Wallet address.
- Action.
- Contract function.
- Status.
- Transaction hash.
- Stellar network.
- JSON metadata.
- Creation timestamp.

Supported statuses:

    pending
    success
    failed

### Feedback Table

The feedback table stores:

- ID.
- Optional linked user ID.
- Wallet address.
- Rating from 1 to 5.
- Written comment.
- Improvement category.
- Creation timestamp.

## Activity and User-State Flow

    User registers profile
            |
            v
    Status: registered
            |
            v
    User connects wallet
            |
            v
    Status: wallet_connected
            |
            v
    User submits Testnet transaction
            |
            v
    Interaction: pending
            |
            +------------------+
            |                  |
            v                  v
         success             failed
            |
            v
    Transaction hash stored
            |
            v
    User status: active

A user is counted as an active wallet only when the backend records a successful interaction with a transaction hash.

## Level 5 Statistics

The statistics service combines:

- User count.
- Verified active wallet count.
- Interaction count.
- Successful transaction count.
- Feedback count.
- Average rating.
- Update timestamp.

Endpoint:

    GET /api/statistics/level-5

The public endpoint returns aggregate values only. It does not expose names, emails, full interaction records, or feedback comments.

## Security Boundaries

### Wallet Security

- Freighter controls wallet authorization.
- Secret keys are never stored by the application.
- Users sign Stellar transactions through Freighter.
- The frontend verifies the selected Stellar network.

### Contract Security

- Administrative contract functions require administrator authorization.
- Arithmetic uses checked operations.
- Faucet claims are limited per wallet.
- Payment actions can be paused.
- Contract configuration is stored on-chain.

### API Security

- Private list routes require `ADMIN_API_KEY`.
- CSV export requires `EXPORT_API_KEY`.
- API keys use constant-time comparison.
- Request JSON size is limited.
- SQL queries use parameters.
- Production requires PostgreSQL.
- Production requires the admin API key.

### Data Security

Public Git history must not contain:

- Database connection strings.
- API keys.
- Wallet secret keys.
- Local environment files.
- Exported user records.
- Private user emails.
- Deployment access tokens.

## Failure Handling

### Wallet Failures

The frontend displays dedicated messages for:

- Missing Freighter.
- Wrong Stellar network.
- User rejection.
- Insufficient Chapter Coin.
- Previously claimed faucet.
- Transaction timeout.
- Contract configuration failure.

### Backend Failures

A backend request failure:

- Does not cancel a submitted Stellar transaction.
- Is logged in the browser console.
- Can be retried.
- Is surfaced in onboarding, feedback, or statistics UI.

### Database Failures

Production startup fails when `DATABASE_URL` is absent.

Database connection failures are visible through:

    GET /health

Local development can use memory storage when `DATABASE_URL` is not configured.

Memory mode is only for development and testing.

## Verification Architecture

Local verifier:

    scripts/verify-level5.ps1

GitHub Actions workflow:

    .github/workflows/level-5.yml

The verification pipeline checks:

- Repository structure.
- Required Level 5 integrations.
- Contract formatting.
- Contract WASM compatibility.
- Contract tests.
- Contract release builds.
- Backend type-checking.
- Backend tests.
- Backend production build.
- Backend security audit.
- Frontend lint.
- Frontend tests.
- Frontend production build.
- Frontend security audit.
- Commit count.
- Environment file protection.
- Git formatting.

## Current Validation Boundary

The technical architecture supports Level 5 user validation.

The repository does not claim that the real-user validation phase has been completed.

Still required separately:

- At least 50 genuine users.
- Distinct Testnet wallets.
- Genuine Testnet transaction hashes.
- Google Form evidence.
- Excel or Google Sheet evidence.
- Feedback-driven product improvements.
- Pitch deck.
- Walkthrough video.
- Final analytics screenshots.

Local smoke-test data must not be counted as real-user evidence.
