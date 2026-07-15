# Stellar Chapter Pay Architecture

## Overview

Stellar Chapter Pay is a Soroban-based application that allows users to claim Chapter Coin and spend those tokens to unlock multiple digital chapters in one transaction.

The project uses a production-oriented structure with separate smart contract, frontend, backend, documentation, deployment, and verification layers.

## Repository Structure

    stellar-chapter-pay
    |-- contracts
    |   `-- chapter-unlock
    |       |-- contracts
    |       |   |-- chapter-payment
    |       |   `-- chapter-token
    |       |-- Cargo.toml
    |       `-- Cargo.lock
    |-- frontend
    |   |-- public
    |   |-- src
    |   |   |-- services
    |   |   |-- utils
    |   |   |-- App.jsx
    |   |   |-- App.css
    |   |   |-- contractConfig.js
    |   |   `-- main.jsx
    |   |-- package.json
    |   `-- vite.config.js
    |-- server
    |   |-- services
    |   |-- index.ts
    |   |-- index.test.ts
    |   |-- package.json
    |   `-- tsconfig.json
    |-- scripts
    |-- docs
    |-- .github
    |-- vercel.json
    |-- railway.toml
    |-- Procfile
    `-- README.md

## Smart Contract Layer

### Chapter Token

The Chapter Token contract manages the Chapter Coin utility token.

Responsibilities:

- Initialize token metadata and administrator.
- Provide a one-time demo token faucet.
- Mint tokens through administrator authorization.
- Transfer tokens between addresses.
- Track balances and total supply.
- Track whether a wallet has claimed demo tokens.
- Publish typed Soroban events.
- Return token statistics.

### Chapter Payment

The Chapter Payment contract manages chapter purchases.

Responsibilities:

- Store the Chapter Token contract address.
- Store the price per chapter.
- Process multi-chapter purchases.
- Call the Chapter Token contract through inter-contract communication.
- Transfer Chapter Coin from the user to the payment contract.
- Store payment records.
- Track chapters unlocked by each user.
- Track total payments, revenue, and unlocked chapters.
- Support administrator price updates.
- Support pause and resume controls.
- Publish typed Soroban events.

## Contract Data Flow

1. A user connects Freighter on Stellar Testnet.
2. The frontend loads the Chapter Token and Chapter Payment contract addresses.
3. The frontend reads the user's Chapter Coin balance.
4. The user selects a chapter quantity.
5. The frontend calculates the estimated total payment.
6. The user signs an unlock transaction with Freighter.
7. The Chapter Payment contract calls the Chapter Token contract.
8. Chapter Coin is transferred from the user to the payment contract.
9. A payment record is stored in persistent storage.
10. The unlocked chapter count and aggregate statistics are updated.
11. The frontend waits for Stellar RPC confirmation.
12. The dashboard refreshes the latest wallet and contract state.

## Frontend Layer

The frontend is built with React and Vite.

Main responsibilities:

- Connect and disconnect Freighter.
- Validate that Freighter is using Stellar Testnet.
- Load contract configuration.
- Read token balances and chapter access data.
- Submit signed Soroban transactions.
- Display pending, success, and failure states.
- Display transaction hashes and explorer links.
- Cache selected wallet and transaction information.
- Track local product analytics.
- Provide a responsive dashboard for desktop and mobile.

### Frontend Service Layer

The frontend separates business logic into services:

- services/contract.js handles Stellar RPC and Soroban transactions.
- services/api.js communicates with the backend API.
- services/analytics.js records local product events.
- contractConfig.js manages network and contract configuration.
- utils/cache.js manages browser cache and purchase validation.

This keeps App.jsx focused on state management and user interface behavior.

## Backend Layer

The backend is built with Express and TypeScript.

Main responsibilities:

- Expose service health information.
- Return Stellar runtime configuration.
- Document contract function coverage.
- Record wallet interactions.
- Collect product feedback.
- Return analytics summaries.
- Return product readiness information.

### Backend Endpoints

- GET /health
- GET /api/config
- GET /api/functions
- GET /api/interactions
- POST /api/interactions
- GET /api/feedback
- POST /api/feedback
- GET /api/analytics
- GET /api/product-readiness

## Storage Model

### On-chain Storage

The Soroban contracts use instance and persistent storage for:

- Contract configuration.
- Token balances.
- Token supply.
- Faucet claims.
- Payment records.
- User chapter counts.
- Aggregate payment statistics.

### Browser Storage

The frontend uses localStorage for:

- Last connected wallet address.
- Last transaction hash.
- Cached Chapter Coin balance.
- Cached chapter count.
- Local analytics events.

### Backend Storage

The current backend uses bounded in-memory collections for product validation records.

This is suitable for the current testnet MVP. A future production version can replace this layer with a persistent database without changing the API contract.

## Security Boundaries

- Freighter handles wallet authorization and transaction signing.
- Administrator-only contract functions require administrator authorization.
- Contract input values are validated before state changes.
- Arithmetic operations use checked calculations.
- Contract events use typed event structures.
- The backend validates interaction and feedback payloads.
- Backend request bodies are size-limited.
- Generated files and environment files are excluded from version control.

## Deployment Architecture

The intended deployment model is:

- Soroban contracts deployed to Stellar Testnet.
- React frontend deployed through Vercel.
- Express backend deployed through Railway.
- Runtime contract addresses supplied through configuration files or environment variables.
- GitHub Actions validates contracts, frontend, backend, and deployment configuration before merge.

## Future Architecture

Future versions may add:

- Persistent backend database storage.
- Mainnet deployment.
- Expanded content ownership records.
- Creator payment distribution.
- Stablecoin or tokenized asset payments.
- Additional wallet integrations.
- Monitoring and external analytics providers.