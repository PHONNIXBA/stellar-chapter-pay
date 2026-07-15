# Stellar Chapter Pay

Stellar Chapter Pay is a Soroban-based application for purchasing access to multiple digital chapters with Chapter Coin.

The application combines two Stellar smart contracts, a responsive React dashboard, an Express backend, product analytics, automated tests, CI/CD, and deployment configuration.

## Problem

Digital content platforms often depend on centralized payment and access systems.

This creates several limitations:

- Payment records are controlled by one platform.
- Users cannot independently verify purchases.
- Access history may be difficult to audit.
- Small content purchases can be inefficient.
- Developers must trust private platform databases.

Stellar Chapter Pay demonstrates a transparent alternative where chapter payments and access records are processed through Soroban contracts on Stellar.

## Why Stellar

Stellar is suitable for this project because it provides:

- Fast transaction settlement.
- Low transaction costs.
- Freighter wallet integration.
- Soroban smart contracts.
- Typed contract events.
- Persistent on-chain storage.
- Inter-contract communication.
- Public and verifiable transaction history.

The current version is configured for Stellar Testnet.

## Main Features

### Chapter Coin

Users can:

- Connect a Freighter wallet.
- Claim a one-time demo Chapter Coin allocation.
- Check their Chapter Coin balance.
- Transfer Chapter Coin through contract interactions.

Administrators can:

- Initialize token metadata.
- Mint Chapter Coin.
- Read token supply statistics.

### Chapter Payments

Users can:

- Select the number of chapters to unlock.
- See the estimated total payment.
- Purchase multiple chapters in one transaction.
- View transaction status.
- Copy the transaction hash.
- Open the transaction in Stellar Explorer.
- Read their total unlocked chapter count.

Administrators can:

- Configure the token contract.
- Set the price per chapter.
- Update the price.
- Pause or resume chapter payments.

### Product Validation

The project includes:

- Local product analytics.
- Wallet interaction tracking.
- Product feedback collection.
- Backend analytics summaries.
- Product readiness reporting.
- Loading, success, and failure states.
- Responsive desktop and mobile layouts.

## Architecture

The application contains four main layers:

    Freighter Wallet
           |
           v
    React Frontend
           |
           +----------------------+
           |                      |
           v                      v
    Stellar RPC             Express Backend
           |                      |
           v                      v
    Chapter Payment        Interactions
           |               Feedback
           v               Analytics
    Chapter Token          Product readiness

## Repository Structure

    stellar-chapter-pay
    |-- .github
    |   `-- workflows
    |       `-- ci.yml
    |
    |-- contracts
    |   `-- chapter-unlock
    |       |-- contracts
    |       |   |-- chapter-payment
    |       |   |   |-- Cargo.toml
    |       |   |   `-- src
    |       |   |       |-- lib.rs
    |       |   |       `-- test.rs
    |       |   |
    |       |   `-- chapter-token
    |       |       |-- Cargo.toml
    |       |       `-- src
    |       |           |-- lib.rs
    |       |           `-- test.rs
    |       |
    |       |-- Cargo.toml
    |       |-- Cargo.lock
    |       `-- README.md
    |
    |-- frontend
    |   |-- public
    |   |   `-- contracts.json
    |   |
    |   |-- src
    |   |   |-- services
    |   |   |   |-- analytics.js
    |   |   |   |-- api.js
    |   |   |   `-- contract.js
    |   |   |
    |   |   |-- utils
    |   |   |   |-- cache.js
    |   |   |   `-- cache.test.js
    |   |   |
    |   |   |-- App.jsx
    |   |   |-- App.css
    |   |   |-- contractConfig.js
    |   |   |-- index.css
    |   |   `-- main.jsx
    |   |
    |   |-- package.json
    |   |-- package-lock.json
    |   `-- vite.config.js
    |
    |-- server
    |   |-- services
    |   |   |-- contractService.ts
    |   |   `-- dataService.ts
    |   |
    |   |-- index.ts
    |   |-- index.test.ts
    |   |-- package.json
    |   |-- package-lock.json
    |   |-- tsconfig.json
    |   |-- tsconfig.build.json
    |   `-- vitest.config.ts
    |
    |-- docs
    |   |-- ARCHITECTURE.md
    |   `-- QUALITY_AND_DEPLOYMENT.md
    |
    |-- scripts
    |   |-- deploy-and-save.ps1
    |   `-- verify-level4.ps1
    |
    |-- Procfile
    |-- railway.toml
    |-- vercel.json
    |-- README.md
    `-- .gitignore

## Smart Contracts

### Chapter Payment Contract

Location:

    contracts/chapter-unlock/contracts/chapter-payment

Responsibilities:

- Process chapter purchases.
- Calculate the total payment.
- Call the Chapter Token contract.
- Transfer Chapter Coin from the user.
- Store payment records.
- Track unlocked chapters.
- Track total revenue.
- Track total payment count.
- Support price administration.
- Support pause and resume controls.
- Publish typed Soroban events.

Contract functions:

| Function | Type | Purpose |
|---|---|---|
| `initialize` | Admin | Configure administrator, token contract, and price |
| `unlock_with_payment` | Write | Pay Chapter Coin and unlock chapters |
| `update_price` | Admin | Update the price per chapter |
| `set_paused` | Admin | Pause or resume payments |
| `get_unlocked_count` | Read | Read a user's unlocked chapter count |
| `is_unlocked` | Read | Check whether a user has unlocked content |
| `get_price_per_chapter` | Read | Read the current chapter price |
| `get_total_price` | Read | Calculate the price for a quantity |
| `get_token_contract` | Read | Read the configured token contract |
| `get_admin` | Read | Read the contract administrator |
| `is_paused` | Read | Read the current pause status |
| `get_payment` | Read | Read a stored payment record |
| `get_stats` | Read | Read aggregate payment statistics |

### Chapter Token Contract

Location:

    contracts/chapter-unlock/contracts/chapter-token

Responsibilities:

- Store token metadata.
- Track balances.
- Track total supply.
- Provide a one-time demo faucet.
- Support administrator minting.
- Transfer tokens.
- Publish typed Soroban events.

Contract functions:

| Function | Type | Purpose |
|---|---|---|
| `initialize` | Admin | Configure token metadata and administrator |
| `faucet` | Write | Claim the one-time demo allocation |
| `mint` | Admin | Mint Chapter Coin |
| `transfer` | Write | Transfer Chapter Coin |
| `balance` | Read | Read an account balance |
| `has_claimed` | Read | Check whether an account used the faucet |
| `name` | Read | Read the token name |
| `symbol` | Read | Read the token symbol |
| `decimals` | Read | Read token decimals |
| `admin` | Read | Read the token administrator |
| `total_supply` | Read | Read total token supply |
| `get_stats` | Read | Read token statistics |

## Payment Flow

1. The user connects Freighter on Stellar Testnet.
2. The frontend loads both contract IDs.
3. The frontend reads the user's Chapter Coin balance.
4. The user chooses a chapter quantity.
5. The frontend calculates the estimated payment.
6. Freighter requests transaction authorization.
7. The Chapter Payment contract calls the Chapter Token contract.
8. Chapter Coin is transferred from the user.
9. A payment record is stored.
10. The user's unlocked chapter count is updated.
11. Aggregate payment statistics are updated.
12. The frontend waits for RPC confirmation.
13. The dashboard refreshes the latest state.

## Frontend

The frontend is built with:

- React
- Vite
- Freighter API
- Stellar JavaScript SDK
- Vitest
- ESLint

The Stellar transaction logic is separated from the main UI component.

Important frontend files:

| File | Purpose |
|---|---|
| `src/App.jsx` | Dashboard state and user interface |
| `src/services/contract.js` | Stellar RPC and Soroban transactions |
| `src/services/api.js` | Backend API requests |
| `src/services/analytics.js` | Local analytics events |
| `src/contractConfig.js` | Stellar network and contract configuration |
| `src/utils/cache.js` | Browser cache and purchase validation |
| `public/contracts.json` | Runtime contract IDs |

## Backend

The backend is built with:

- Node.js
- Express
- TypeScript
- Vitest
- Supertest

Backend endpoints:

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Service health check |
| GET | `/api/config` | Stellar runtime configuration |
| GET | `/api/functions` | Contract function coverage |
| GET | `/api/interactions` | List wallet interactions |
| POST | `/api/interactions` | Record a wallet interaction |
| GET | `/api/feedback` | List product feedback |
| POST | `/api/feedback` | Submit product feedback |
| GET | `/api/analytics` | Product analytics summary |
| GET | `/api/product-readiness` | Product readiness status |

The current backend uses bounded in-memory storage for product validation data.

This is suitable for Testnet MVP validation. A persistent database can replace the storage service in a later version.

## Requirements

Recommended local environment:

- Node.js 24 or newer
- npm 11 or newer
- Rust 1.96 or newer
- Cargo 1.96 or newer
- Stellar CLI 27 or newer
- Git
- PowerShell
- Freighter wallet
- Rust target `wasm32v1-none`

Install the Rust target:

    rustup target add wasm32v1-none

Confirm the tools:

    node --version
    npm --version
    rustc --version
    cargo --version
    stellar --version
    git --version

## Run the Frontend

Open PowerShell in VS Code:

    Set-Location "D:\StellarBuilds\stellar-chapter-pay\frontend"

    npm ci
    npm run dev

The Vite development server normally starts at:

    http://localhost:5173

## Run the Backend

Open another PowerShell terminal:

    Set-Location "D:\StellarBuilds\stellar-chapter-pay\server"

    npm ci
    npm run dev

The backend normally starts at:

    http://localhost:3001

Health endpoint:

    http://localhost:3001/health

## Backend Environment

Copy:

    server/.env.example

to:

    server/.env

Available variables:

    PORT=3001
    CORS_ORIGIN=http://localhost:5173
    STELLAR_NETWORK=TESTNET
    STELLAR_RPC_URL=https://soroban-testnet.stellar.org:443
    STELLAR_EXPLORER_URL=https://stellar.expert/explorer/testnet
    CHAPTER_PAYMENT_CONTRACT_ID=
    CHAPTER_TOKEN_CONTRACT_ID=

Do not commit the `.env` file.

## Contract Configuration

The frontend loads contract IDs from:

    frontend/public/contracts.json

Expected structure:

    {
      "network": "TESTNET",
      "chapter_contract_id": "C...",
      "token_contract_id": "C...",
      "updated_at": "2026-01-01T00:00:00.000Z"
    }

The deployment script updates this file automatically after deployment.

## Contract Validation

Run from the contract workspace:

    Set-Location "D:\StellarBuilds\stellar-chapter-pay\contracts\chapter-unlock"

    cargo fmt --all -- --check
    cargo check --workspace --locked --target wasm32v1-none
    cargo test --workspace --locked
    cargo build --workspace --locked --target wasm32v1-none --release
    stellar contract build

Current automated contract coverage:

- 7 Chapter Payment tests.
- 7 Chapter Token tests.
- 14 total smart contract tests.

## Frontend Validation

    Set-Location "D:\StellarBuilds\stellar-chapter-pay\frontend"

    npm ci
    npm run lint
    npm test
    npm run build
    npm audit

Current frontend test coverage includes:

- Cache storage.
- Cache removal.
- Application cache clearing.
- Soroban integer normalization.
- Wallet validation.
- Quantity validation.
- Balance validation.
- Chapter purchase eligibility.

## Backend Validation

    Set-Location "D:\StellarBuilds\stellar-chapter-pay\server"

    npm ci
    npm run type-check
    npm test
    npm run build
    npm audit

Current backend coverage includes:

- Health response.
- Runtime configuration.
- Contract function coverage.
- Interaction creation.
- Interaction validation.
- Interaction listing.
- Feedback creation.
- Feedback validation.
- Analytics summaries.
- Product readiness.
- Structured 404 responses.

## Full Level 4 Verification

Run the complete local verification from the repository root:

    Set-Location "D:\StellarBuilds\stellar-chapter-pay"

    Set-ExecutionPolicy `
        -Scope Process `
        -ExecutionPolicy Bypass

    .\scripts\verify-level4.ps1

The script checks:

- Required files.
- Git identity and remote.
- Generated file tracking.
- Old template references.
- Public documentation wording.
- Deployment configuration.
- CI configuration.
- Contract formatting.
- Contract tests.
- WASM builds.
- Stellar contract builds.
- Frontend lint.
- Frontend tests.
- Frontend build.
- Frontend dependency audit.
- Backend type-check.
- Backend tests.
- Backend build.
- Backend dependency audit.
- Git formatting.

Expected final message:

    Level 4 local verification passed.

## Deploy Contracts to Stellar Testnet

The deployment script:

- Verifies the local environment.
- Creates or loads a Testnet deployer identity.
- Builds both contracts.
- Deploys Chapter Token.
- Deploys Chapter Payment.
- Initializes both contracts.
- Saves the deployed contract IDs.
- Updates the frontend runtime configuration.

Run:

    Set-Location "D:\StellarBuilds\stellar-chapter-pay"

    .\scripts\deploy-and-save.ps1

Optional parameters:

    .\scripts\deploy-and-save.ps1 `
        -Identity "chapter-pay-deployer" `
        -Network "testnet" `
        -PricePerChapter 5 `
        -TokenName "Chapter Coin" `
        -TokenSymbol "COIN" `
        -TokenDecimals 0

Deployment output is saved to:

    frontend/public/contracts.json
    CONTRACT_ID.txt

## Deployment

### Frontend with Vercel

The repository includes:

    vercel.json

Configured commands:

    Install: cd frontend && npm ci
    Build: cd frontend && npm run build
    Output: frontend/dist

Optional environment variable:

    VITE_API_URL=https://your-backend-domain.example

### Backend with Railway

The repository includes:

    railway.toml
    Procfile

Configured commands:

    Build: cd server && npm ci && npm run build
    Start: cd server && npm start
    Health check: /health

Railway environment variables should be configured through the Railway dashboard.

## Continuous Integration

GitHub Actions configuration:

    .github/workflows/ci.yml

CI jobs:

1. Smart Contract CI
2. Frontend CI
3. Backend CI
4. Deployment Config Detection

The smart contract CI validates the Rust workspace without requiring Stellar CLI installation on the GitHub runner.

## Security and Quality

The project includes:

- Administrator authorization.
- Checked arithmetic.
- Typed contract errors.
- Typed Soroban events.
- Input validation.
- One-time faucet protection.
- Insufficient balance handling.
- Transaction rejection handling.
- Loading states.
- Failure states.
- Request body size limits.
- Dependency audits.
- Environment file protection.
- Generated file protection.
- Automated CI validation.

Never commit:

- `.env`
- `.env.local`
- `node_modules`
- `dist`
- `target`
- `.vite`
- local backup files
- deployment temporary files
- contract test snapshots

## Documentation

Additional documentation:

- `docs/ARCHITECTURE.md`
- `docs/QUALITY_AND_DEPLOYMENT.md`
- `contracts/chapter-unlock/README.md`

## Current Scope

This repository is a Stellar Testnet MVP.

Current limitations:

- Backend analytics data is stored in memory.
- Contract IDs must be deployed and configured before live transactions.
- Chapter content delivery is represented by access counts.
- Mainnet deployment is not included in the current version.

## Roadmap

### Testnet MVP

- Deploy contracts to Stellar Testnet.
- Validate Freighter onboarding.
- Test bulk chapter purchases.
- Collect user feedback.
- Track wallet interactions.
- Monitor transaction reliability.

### Product Validation

- Add persistent analytics storage.
- Improve onboarding based on feedback.
- Expand content access records.
- Add creator and publisher dashboards.
- Improve transaction monitoring.

### Future Production Version

- Persistent database integration.
- Mainnet deployment.
- Creator revenue distribution.
- Expanded content ownership records.
- Additional wallet support.
- External monitoring and analytics.
- Stablecoin payment options.

## License

This project is provided for Stellar development, testing, and product validation.