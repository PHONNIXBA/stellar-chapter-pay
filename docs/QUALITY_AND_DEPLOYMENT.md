# Quality and Deployment

## Purpose

This document defines the technical quality gates and release process for Stellar Chapter Pay.

The Level 5 technical implementation includes:

- Soroban contracts.
- Freighter integration.
- User onboarding.
- PostgreSQL persistence.
- Transaction activity tracking.
- Product feedback.
- Live usage statistics.
- Protected administration.
- CSV export.
- Automated local verification.
- GitHub Actions verification.
- Railway and Vercel deployment configuration.

Real-user evidence is a separate validation phase.

## Quality Principles

Every release must:

- Preserve existing product behavior.
- Use meaningful commits.
- Pass automated tests.
- Pass production builds.
- Pass dependency audits.
- Avoid tracked secrets.
- Avoid generated build output in Git.
- Keep private user data outside the public repository.
- Use genuine evidence only.
- Clearly distinguish test data from real usage.

## Repository Quality Gate

Run from:

    D:\StellarBuilds\stellar-chapter-pay

Command:

    powershell.exe `
        -NoProfile `
        -ExecutionPolicy Bypass `
        -File ".\scripts\verify-level5.ps1"

Expected result:

    LEVEL 5 TECHNICAL VERIFICATION PASSED

For a faster repeated local check with installed dependencies:

    powershell.exe `
        -NoProfile `
        -ExecutionPolicy Bypass `
        -File ".\scripts\verify-level5.ps1" `
        -SkipInstall

## Smart Contract Quality

Contract workspace:

    contracts/chapter-unlock

Required checks:

    cargo fmt --all -- --check

    cargo check `
        --workspace `
        --target wasm32v1-none `
        --locked

    cargo test `
        --workspace `
        --locked

    cargo build `
        --workspace `
        --target wasm32v1-none `
        --release `
        --locked

The workspace currently contains tests for:

- Chapter Token initialization.
- Administrator behavior.
- Faucet behavior.
- Balance behavior.
- Transfer behavior.
- Token metadata.
- Chapter Payment initialization.
- Pricing.
- Multi-chapter payments.
- Access counts.
- Aggregate statistics.
- Pause and resume behavior.
- Administrative authorization.
- Failure conditions.

## Backend Quality

Backend directory:

    server

Required commands:

    npm ci
    npm run type-check
    npm test
    npm run build
    npm audit --audit-level=high

The backend test suite covers:

- Health information.
- Runtime configuration.
- Contract function information.
- User registration.
- Wallet-to-user mapping.
- User lookup.
- User listing authorization.
- Interaction creation.
- Interaction listing authorization.
- Feedback creation.
- Feedback listing authorization.
- Analytics.
- Level 5 statistics.
- CSV export authorization.
- Admin API key behavior.
- PostgreSQL configuration.
- Database schema.
- Memory fallback behavior.
- Product readiness.
- Unknown routes.

## Frontend Quality

Frontend directory:

    frontend

Required commands:

    npm ci
    npm run lint
    npm test
    npm run build
    npm audit --audit-level=high

The frontend test suite covers:

- Cache helpers.
- User onboarding validation.
- Backend API behavior.
- Activity synchronization.
- Feedback validation.
- Level 5 statistics normalization.
- Statistics API behavior.

Production build output must not remain tracked.

Generated directory:

    frontend/dist

## Dependency Security

Both frontend and backend must pass:

    npm audit --audit-level=high

A release must not proceed with unresolved high or critical vulnerabilities.

Dependency upgrades should:

- Use exact or controlled versions where appropriate.
- Regenerate package lockfiles.
- Run all tests after changes.
- Run production builds after changes.
- Avoid unrelated dependency changes.

## Secret Protection

Never commit:

- `.env`
- `.env.local`
- `DATABASE_URL`
- `ADMIN_API_KEY`
- `EXPORT_API_KEY`
- Railway access tokens
- Vercel access tokens
- Stellar secret keys
- Exported user CSV files
- Private user data

Example environment files may be committed only when they contain placeholders.

The Level 5 verifier checks that private environment files are not tracked.

## API Security

Private list endpoints require:

    x-admin-api-key

Protected routes:

    GET /api/users
    GET /api/interactions
    GET /api/feedback

The data export endpoint requires:

    x-export-api-key

Protected export route:

    GET /api/exports/level-5.csv

Public aggregate statistics do not expose personally identifiable information.

Public statistics route:

    GET /api/statistics/level-5

## Production Requirements

The backend refuses production startup without:

    DATABASE_URL
    ADMIN_API_KEY

The export endpoint is unavailable without:

    EXPORT_API_KEY

Recommended production values:

    NODE_ENV=production
    DATABASE_URL=<managed-postgresql-url>
    ADMIN_API_KEY=<long-random-secret>
    EXPORT_API_KEY=<different-long-random-secret>
    CORS_ORIGIN=https://your-frontend-domain.example

Frontend:

    VITE_API_BASE_URL=https://your-backend-domain.example

Do not use the same value for admin and export keys.

## Deployment Order

Recommended order:

1. Run full local verification.
2. Commit all intended changes.
3. Push `main`.
4. Confirm GitHub Actions passes.
5. Create the PostgreSQL database.
6. Deploy the Railway backend.
7. Verify `/health`.
8. Verify `/api/statistics/level-5`.
9. Deploy the Vercel frontend.
10. Update Railway `CORS_ORIGIN`.
11. Run an end-to-end smoke test.
12. Record deployment URLs in the README or submission materials.

Detailed steps:

- [Deployment Guide](DEPLOYMENT.md)
- [Level 5 Implementation](LEVEL5_IMPLEMENTATION.md)
- [Architecture](ARCHITECTURE.md)

## Railway Backend Checks

After deployment, verify:

    https://your-backend-domain.example/health

Expected storage:

    postgresql

Verify public statistics:

    https://your-backend-domain.example/api/statistics/level-5

Verify private endpoint protection:

    GET /api/users

Without the correct key, the response must be:

    401 Unauthorized

## Vercel Frontend Checks

After deployment:

1. Open the Vercel URL.
2. Check that no blank page appears.
3. Confirm contract configuration loads.
4. Confirm the Level 5 statistics request reaches the backend.
5. Connect Freighter on Testnet.
6. Complete onboarding.
7. Claim demo Chapter Coin.
8. Unlock a chapter.
9. Open the transaction explorer link.
10. Submit feedback.
11. Refresh Level 5 statistics.

## Production Smoke-Test Data

One deployment smoke-test profile may be created to verify the system.

It must be clearly identified as test data.

It must not be counted toward:

- Genuine user totals.
- Genuine feedback totals.
- Genuine transaction adoption.
- Final Level 5 evidence.

The smoke-test record may be removed from PostgreSQL before real-user onboarding begins.

## Continuous Integration

Workflow:

    .github/workflows/level-5.yml

The workflow runs on:

- Push to `main`.
- Push to `level-5-upgrade`.
- Pull requests targeting `main`.
- Manual workflow dispatch.

The workflow verifies:

- Rust contract workspace.
- Backend.
- Frontend.
- Security checks.
- Repository requirements.

A release should not proceed while the Level 5 workflow is failing.

## Git Quality

Before committing:

    git diff --check

Inspect changes:

    git -c core.pager=cat diff --stat

Inspect contributors:

    git -c core.pager=cat shortlog -sne --all

Inspect working tree:

    git status --short --branch

Commit messages should follow Conventional Commits.

Examples:

    feat(frontend): add product feedback form

    feat(api): add Level 5 statistics endpoint

    feat(security): protect private admin endpoints

    ci: add Level 5 verification workflow

    docs: document Level 5 architecture and deployment

Do not create fake commits solely to increase commit count.

## Release Checklist

Technical checklist:

- [ ] Contract formatting passes.
- [ ] Contract WASM check passes.
- [ ] Contract tests pass.
- [ ] Contract release build passes.
- [ ] Backend type-check passes.
- [ ] Backend tests pass.
- [ ] Backend build passes.
- [ ] Backend audit passes.
- [ ] Frontend lint passes.
- [ ] Frontend tests pass.
- [ ] Frontend build passes.
- [ ] Frontend audit passes.
- [ ] `git diff --check` passes.
- [ ] No private environment files are tracked.
- [ ] GitHub Actions passes.
- [ ] PostgreSQL health is confirmed.
- [ ] Backend production URL works.
- [ ] Frontend production URL works.
- [ ] Admin endpoints reject invalid keys.
- [ ] Export endpoint rejects invalid keys.
- [ ] End-to-end Testnet smoke test succeeds.

Level 5 evidence checklist:

- [ ] At least 50 genuine Testnet users.
- [ ] Distinct real wallet addresses.
- [ ] Genuine successful transaction hashes.
- [ ] Google Form responses.
- [ ] Excel or Google Sheet export.
- [ ] Feedback summary.
- [ ] Improvements based on feedback.
- [ ] Commit links for improvements.
- [ ] Final analytics screenshots.
- [ ] Professional pitch deck.
- [ ] Complete walkthrough video.

The evidence checklist remains separate from technical deployment readiness.

## Rollback Quality Gate

Frontend rollback:

1. Restore the previous successful Vercel deployment.
2. Verify `VITE_API_BASE_URL`.
3. Retest the statistics dashboard.
4. Retest Freighter connection.

Backend rollback:

1. Restore the previous successful Railway deployment.
2. Preserve PostgreSQL data.
3. Verify environment variables.
4. Verify `/health`.
5. Verify private endpoint protection.

Contract changes require a new Testnet deployment and a deliberate contract ID update. Existing Testnet contracts are not automatically rolled back.

## Current Status

The Level 5 technical infrastructure is implemented and locally verified.

The project is ready for final documentation verification, deployment configuration review, and later real-user validation.

No claim is made that the required real-user validation evidence has already been completed.
