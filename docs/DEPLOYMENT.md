# Level 5 Deployment Guide

## Deployment Model

Stellar Chapter Pay uses four deployed components:

1. Chapter Token contract on Stellar Testnet.
2. Chapter Payment contract on Stellar Testnet.
3. Express and PostgreSQL backend on Railway.
4. React frontend on Vercel.

Recommended deployment order:

1. PostgreSQL database.
2. Railway backend.
3. Vercel frontend.
4. End-to-end smoke test.

## Testnet Contracts

Chapter Payment:

    CD4Q4QQRSLMXOZCUE72OAXLKA5XBGAEO4G4O37BF4QIMOY7GQUHTAE2O

Chapter Token:

    CD4IL6YDYQRRLH5RKJCQ2D4XGQWJSLSOKBTGL6UE6VLBBL4I4EWEXTNR

The frontend contract configuration is stored in:

    frontend/public/contracts.json

## Pre-Deployment Verification

Run from the repository root:

    Set-Location "D:\StellarBuilds\stellar-chapter-pay"

    powershell.exe `
        -NoProfile `
        -ExecutionPolicy Bypass `
        -File ".\scripts\verify-level5.ps1"

Deployment should continue only after:

    LEVEL 5 TECHNICAL VERIFICATION PASSED

## Railway Backend

The repository contains:

    railway.toml
    Procfile

The deployment configuration builds and starts the application from the server directory.

Health endpoint:

    /health

### Required Railway Variables

Configure secrets through the Railway dashboard.

    NODE_ENV=production

    DATABASE_URL=<managed-postgresql-connection-string>

    ADMIN_API_KEY=<long-random-secret>

    EXPORT_API_KEY=<different-long-random-secret>

    CORS_ORIGIN=https://your-frontend-domain.example

### Stellar Runtime Variables

    STELLAR_NETWORK=TESTNET

    STELLAR_RPC_URL=https://soroban-testnet.stellar.org:443

    STELLAR_EXPLORER_URL=https://stellar.expert/explorer/testnet

    CHAPTER_PAYMENT_CONTRACT_ID=CD4Q4QQRSLMXOZCUE72OAXLKA5XBGAEO4G4O37BF4QIMOY7GQUHTAE2O

    CHAPTER_TOKEN_CONTRACT_ID=CD4IL6YDYQRRLH5RKJCQ2D4XGQWJSLSOKBTGL6UE6VLBBL4I4EWEXTNR

### Optional PostgreSQL Pool Variables

    DATABASE_SSL=true

    DATABASE_SSL_REJECT_UNAUTHORIZED=true

    DATABASE_POOL_MAX=10

    DATABASE_IDLE_TIMEOUT_MS=30000

    DATABASE_CONNECTION_TIMEOUT_MS=5000

Use the SSL requirements provided by the database provider. Do not disable certificate verification unless the provider specifically requires it.

### Backend Health Test

After Railway deployment, open:

    https://your-backend-domain.example/health

Expected response includes:

    {
      "status": "ok",
      "service": "stellar-chapter-pay-server",
      "storage": "postgresql"
    }

Statistics endpoint:

    https://your-backend-domain.example/api/statistics/level-5

## Vercel Frontend

The repository contains:

    vercel.json

The frontend is built from:

    frontend

### Required Vercel Variable

    VITE_API_BASE_URL=https://your-backend-domain.example

Do not add a trailing slash.

After adding or changing the variable, redeploy the frontend.

### CORS Update

After the final Vercel domain is known, update Railway:

    CORS_ORIGIN=https://your-frontend-domain.example

Redeploy or restart the Railway service after changing the value.

## Production Smoke Test

Complete these checks after deployment:

1. Open the frontend.
2. Confirm the page loads without console errors.
3. Confirm the Level 5 statistics dashboard loads.
4. Connect Freighter.
5. Confirm Freighter uses Stellar Testnet.
6. Register one test profile.
7. Claim demo Chapter Coin.
8. Confirm the transaction reaches success.
9. Copy and open the transaction hash.
10. Unlock at least one chapter.
11. Confirm the second transaction succeeds.
12. Submit one feedback response.
13. Refresh the Level 5 dashboard.
14. Confirm the backend reports PostgreSQL storage.

The deployment smoke-test record must be identified as testing data and must not be included in the final real-user total.

## Admin Endpoint Test

Use PowerShell without saving the secret into the repository:

    $Backend = "https://your-backend-domain.example"
    $AdminKey = Read-Host "Enter ADMIN_API_KEY"

    Invoke-RestMethod `
        -Uri "$Backend/api/users" `
        -Headers @{
            "x-admin-api-key" = $AdminKey
        }

Private endpoints should return 401 without the correct header.

## Export Level 5 Data

Use:

    $Backend = "https://your-backend-domain.example"
    $ExportKey = Read-Host "Enter EXPORT_API_KEY"

    Invoke-WebRequest `
        -Uri "$Backend/api/exports/level-5.csv" `
        -Headers @{
            "x-export-api-key" = $ExportKey
        } `
        -OutFile ".\stellar-chapter-pay-level-5.csv"

The CSV file can be opened with Microsoft Excel or imported into Google Sheets.

Do not commit exported user data into the public repository.

## Secret Management

Never commit:

- DATABASE_URL.
- ADMIN_API_KEY.
- EXPORT_API_KEY.
- Local .env files.
- Exported user data.
- Private user emails.
- Railway or Vercel access tokens.
- Stellar secret keys.

Use different values for ADMIN_API_KEY and EXPORT_API_KEY.

Rotate a key immediately when it is exposed.

## Rollback

When a frontend deployment fails:

1. Open the Vercel deployment history.
2. Promote the last successful deployment.
3. Verify VITE_API_BASE_URL.
4. Re-run the frontend smoke test.

When a backend deployment fails:

1. Inspect Railway build and runtime logs.
2. Confirm all required environment variables.
3. Confirm PostgreSQL is available.
4. Roll back to the previous successful Railway deployment.
5. Recheck /health before reopening the frontend.

Contract rollback is not automatic. Existing deployed Soroban contracts remain on Testnet, so contract IDs must only be changed after a new deployment has been tested.
