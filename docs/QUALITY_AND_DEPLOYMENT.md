# Quality and Deployment

## Quality Goals

Stellar Chapter Pay is structured as a production-ready testnet MVP rather than a single-file demonstration.

Quality validation covers:

- Soroban contract formatting.
- Soroban contract tests.
- WASM contract checks.
- WASM release builds.
- Frontend linting.
- Frontend tests.
- Frontend production builds.
- Backend type-checking.
- Backend tests.
- Backend production builds.
- Dependency security audits.
- Deployment configuration detection.
- Repository structure validation.

## Smart Contract Validation

Run from contracts/chapter-unlock:

    cargo fmt --all -- --check
    cargo check --workspace --target wasm32v1-none
    cargo test --workspace
    cargo build --workspace --target wasm32v1-none --release

Current contract coverage includes:

- Token initialization.
- Token metadata.
- Faucet claims.
- Token minting.
- Token transfers.
- Insufficient balance handling.
- Chapter Payment initialization.
- Multi-chapter payments.
- Inter-contract token transfers.
- Payment record storage.
- Aggregate payment statistics.
- Administrator price updates.
- Pause and resume controls.
- Invalid quantity handling.

## Frontend Validation

Run from frontend:

    npm ci
    npm run lint
    npm test
    npm run build
    npm audit

Frontend validation covers:

- Browser cache helpers.
- Purchase eligibility validation.
- Contract configuration loading.
- Responsive production build.
- Contract service integration.
- Wallet and transaction state handling.
- Dependency security.

Generated frontend files are excluded from version control.

## Backend Validation

Run from server:

    npm ci
    npm run type-check
    npm test
    npm run build
    npm audit

Backend validation covers:

- Health endpoint.
- Runtime configuration endpoint.
- Contract function coverage.
- Wallet interaction recording.
- Interaction validation.
- Feedback recording.
- Feedback validation.
- Analytics summaries.
- Product readiness reporting.
- Structured 404 responses.

## Continuous Integration

GitHub Actions validates four areas:

1. Smart Contract CI
2. Frontend CI
3. Backend CI
4. Deployment Configuration Detection

The smart contract job does not require installing Stellar CLI on the GitHub runner. It validates the Rust workspace directly with Cargo and the wasm32v1-none target.

Local deployment remains the responsibility of the PowerShell deployment script.

## Frontend Deployment

The frontend is designed for Vercel.

Expected deployment settings:

- Root directory: frontend
- Framework: Vite
- Install command: npm ci
- Build command: npm run build
- Output directory: dist

Optional environment variable:

    VITE_API_URL=https://your-backend-domain.example

## Backend Deployment

The backend is designed for Railway.

Expected deployment settings:

- Root directory: server
- Install command: npm ci
- Build command: npm run build
- Start command: npm start

Required or optional environment variables:

    PORT=3001
    CORS_ORIGIN=https://your-frontend-domain.example
    STELLAR_NETWORK=TESTNET
    STELLAR_RPC_URL=https://soroban-testnet.stellar.org:443
    STELLAR_EXPLORER_URL=https://stellar.expert/explorer/testnet
    CHAPTER_PAYMENT_CONTRACT_ID=
    CHAPTER_TOKEN_CONTRACT_ID=

Contract IDs must be populated after deployment.

## Contract Deployment

The local deployment workflow should:

1. Format contract source files.
2. Run contract tests.
3. Build Soroban WASM files.
4. Confirm or create a Stellar Testnet identity.
5. Deploy Chapter Token.
6. Deploy Chapter Payment.
7. Initialize Chapter Token.
8. Initialize Chapter Payment with the Chapter Token address.
9. Store deployed contract IDs.
10. Update frontend runtime configuration.

## Generated Files

The following files and directories must not be committed:

- node_modules
- dist
- target
- .vite
- .stellar
- .env
- .env.local
- deployment temporary output
- local backup files
- Soroban test snapshots

Lockfiles must remain committed:

- Cargo.lock
- frontend/package-lock.json
- server/package-lock.json

## Pre-Push Verification

Before pushing:

    git remote -v
    git config user.name
    git config user.email
    git status
    git diff --check

Then run the full verification script.

Expected result:

    Level 4 local verification passed.

After verification, confirm:

- Working tree is clean.
- Git remote points to the correct repository.
- Commit author and committer use the correct account.
- No generated files are tracked.
- GitHub Actions is green.
- README and architecture documentation match the implemented functions.

## Production Readiness Notes

The current backend stores product validation data in memory. This is appropriate for the current testnet validation phase but does not persist through server restarts.

Before long-term production usage, replace the in-memory storage implementation with a managed persistent database.

The API structure is already separated from the storage service, allowing this change without restructuring frontend integration.