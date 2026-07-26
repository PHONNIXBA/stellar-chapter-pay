[CmdletBinding()]
param(
    [switch]$SkipInstall,
    [switch]$SkipContractBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Repo = Split-Path `
    -Parent `
    $PSScriptRoot

$ContractWorkspace = Join-Path `
    $Repo `
    "contracts\chapter-unlock"

$Server = Join-Path `
    $Repo `
    "server"

$Frontend = Join-Path `
    $Repo `
    "frontend"

Set-Location $Repo

function Write-Step {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Message
    )

    Write-Host ""
    Write-Host "========================================" `
        -ForegroundColor Cyan

    Write-Host $Message `
        -ForegroundColor Cyan

    Write-Host "========================================" `
        -ForegroundColor Cyan
}

function Invoke-CheckedCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,

        [Parameter(Mandatory = $true)]
        [string]$WorkingDirectory,

        [Parameter(Mandatory = $true)]
        [string]$Command,

        [string[]]$Arguments = @()
    )

    Write-Host ""
    Write-Host "Running: $Name" `
        -ForegroundColor Yellow

    Push-Location $WorkingDirectory

    try {
        & $Command @Arguments

        if ($LASTEXITCODE -ne 0) {
            throw (
                "$Name failed with exit code " +
                "$LASTEXITCODE."
            )
        }
    }
    finally {
        Pop-Location
    }

    Write-Host "Passed: $Name" `
        -ForegroundColor Green
}

function Require-File {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    $FullPath = Join-Path `
        $Repo `
        $Path

    if (
        -not (
            Test-Path `
                -LiteralPath $FullPath `
                -PathType Leaf
        )
    ) {
        throw (
            "Required file is missing: " +
            $Path
        )
    }

    Write-Host "Found: $Path" `
        -ForegroundColor Green
}

function Require-Text {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,

        [Parameter(Mandatory = $true)]
        [string[]]$Patterns
    )

    $FullPath = Join-Path `
        $Repo `
        $Path

    $FileContent = Get-Content `
        -LiteralPath $FullPath `
        -Raw

    foreach ($Pattern in $Patterns) {
        if (
            $FileContent -notmatch
            [Regex]::Escape($Pattern)
        ) {
            throw (
                "$Path does not contain " +
                "required text: $Pattern"
            )
        }
    }

    Write-Host "Content passed: $Path" `
        -ForegroundColor Green
}

Write-Step "1. Repository structure"

$RequiredFiles = @(
    ".github/workflows/level-5.yml",

    "contracts/chapter-unlock/Cargo.toml",
    "contracts/chapter-unlock/Cargo.lock",
    "contracts/chapter-unlock/README.md",

    "contracts/chapter-unlock/contracts/chapter-payment/Cargo.toml",
    "contracts/chapter-unlock/contracts/chapter-payment/src/lib.rs",
    "contracts/chapter-unlock/contracts/chapter-payment/src/test.rs",

    "contracts/chapter-unlock/contracts/chapter-token/Cargo.toml",
    "contracts/chapter-unlock/contracts/chapter-token/src/lib.rs",
    "contracts/chapter-unlock/contracts/chapter-token/src/test.rs",

    "frontend/package.json",
    "frontend/package-lock.json",
    "frontend/src/App.jsx",
    "frontend/src/components/OnboardingForm.jsx",
    "frontend/src/components/FeedbackForm.jsx",
    "frontend/src/components/Level5Dashboard.jsx",
    "frontend/src/components/Level5Stats.jsx",
    "frontend/src/services/activitySync.js",
    "frontend/src/services/statisticsApi.js",

    "server/package.json",
    "server/package-lock.json",
    "server/.env.example",
    "server/index.ts",
    "server/services/databaseService.ts",
    "server/services/adminAuth.ts",
    "server/services/statisticsService.ts",
    "server/services/exportService.ts",

    "README.md",
    "CONTRACT_ID.txt",
    "railway.toml",
    "vercel.json",
    "Procfile"
)

foreach ($File in $RequiredFiles) {
    Require-File -Path $File
}

Write-Step "2. Level 5 source checks"

Require-Text `
    -Path "frontend/src/App.jsx" `
    -Patterns @(
        "OnboardingForm",
        "FeedbackForm",
        "Level5Dashboard",
        "recordRemoteInteraction"
    )

Require-Text `
    -Path "server/index.ts" `
    -Patterns @(
        "/api/statistics/level-5",
        "/api/exports/level-5.csv",
        "requireAdminApiKey",
        "ADMIN_API_KEY is required in production"
    )

Require-Text `
    -Path "server/.env.example" `
    -Patterns @(
        "DATABASE_URL=",
        "EXPORT_API_KEY=",
        "ADMIN_API_KEY="
    )

Require-Text `
    -Path "server/services/databaseService.ts" `
    -Patterns @(
        "CREATE TABLE IF NOT EXISTS users",
        "CREATE TABLE IF NOT EXISTS interactions",
        "CREATE TABLE IF NOT EXISTS feedback"
    )

Require-Text `
    -Path "contracts/chapter-unlock/Cargo.toml" `
    -Patterns @(
        "[workspace]",
        "contracts/*"
    )

Write-Step "3. Git and environment security"

$CommitCountOutput = (
    & git rev-list --count HEAD |
    Out-String
).Trim()

if ($LASTEXITCODE -ne 0) {
    throw "Git commit count could not be read."
}

$CommitCount = [int]$CommitCountOutput

Write-Host "Commit count: $CommitCount"

if ($CommitCount -lt 20) {
    throw (
        "Level 5 requires at least " +
        "20 meaningful commits."
    )
}

$TrackedSensitiveFiles = @(
    & git ls-files |
    Where-Object {
        $_ -match '(^|/)\.env($|\.)' -and
        $_ -notmatch 'example'
    }
)

if ($LASTEXITCODE -ne 0) {
    throw (
        "Tracked file list could not " +
        "be read."
    )
}

if (
    $TrackedSensitiveFiles.Count -gt 0
) {
    Write-Host "Tracked sensitive files:" `
        -ForegroundColor Red

    $TrackedSensitiveFiles |
        ForEach-Object {
            Write-Host "  $_"
        }

    throw (
        "Sensitive environment files " +
        "are tracked by Git."
    )
}

Write-Host `
    "No private .env files are tracked." `
    -ForegroundColor Green

Invoke-CheckedCommand `
    -Name "Git diff validation" `
    -WorkingDirectory $Repo `
    -Command "git" `
    -Arguments @(
        "diff",
        "--check"
    )

if (-not $SkipContractBuild) {
    Write-Step "4. Soroban contract verification"

    if (
        -not (
            Test-Path `
                -LiteralPath $ContractWorkspace `
                -PathType Container
        )
    ) {
        throw (
            "Contract workspace is missing: " +
            $ContractWorkspace
        )
    }

    $InstalledTargets = @(
        & rustup target list --installed
    )

    if ($LASTEXITCODE -ne 0) {
        throw (
            "Installed Rust targets " +
            "could not be read."
        )
    }

    if (
        $InstalledTargets -notcontains
        "wasm32v1-none"
    ) {
        throw (
            "Rust target wasm32v1-none " +
            "is not installed."
        )
    }

    $UseLockedDependencies =
        Test-Path `
            -LiteralPath (
                Join-Path `
                    $ContractWorkspace `
                    "Cargo.lock"
            ) `
            -PathType Leaf

    $CargoCheckArguments = @(
        "check",
        "--workspace",
        "--target",
        "wasm32v1-none"
    )

    $CargoTestArguments = @(
        "test",
        "--workspace"
    )

    $CargoBuildArguments = @(
        "build",
        "--workspace",
        "--target",
        "wasm32v1-none",
        "--release"
    )

    if ($UseLockedDependencies) {
        $CargoCheckArguments +=
            "--locked"

        $CargoTestArguments +=
            "--locked"

        $CargoBuildArguments +=
            "--locked"
    }

    Invoke-CheckedCommand `
        -Name "Contract formatting" `
        -WorkingDirectory $ContractWorkspace `
        -Command "cargo" `
        -Arguments @(
            "fmt",
            "--all",
            "--",
            "--check"
        )

    Invoke-CheckedCommand `
        -Name "Contract WASM check" `
        -WorkingDirectory $ContractWorkspace `
        -Command "cargo" `
        -Arguments $CargoCheckArguments

    Invoke-CheckedCommand `
        -Name "Contract tests" `
        -WorkingDirectory $ContractWorkspace `
        -Command "cargo" `
        -Arguments $CargoTestArguments

    Invoke-CheckedCommand `
        -Name "Contract release build" `
        -WorkingDirectory $ContractWorkspace `
        -Command "cargo" `
        -Arguments $CargoBuildArguments
}
else {
    Write-Host ""
    Write-Host "Contract build skipped." `
        -ForegroundColor Yellow
}

Write-Step "5. Backend verification"

if (-not $SkipInstall) {
    Invoke-CheckedCommand `
        -Name "Backend clean install" `
        -WorkingDirectory $Server `
        -Command "npm" `
        -Arguments @(
            "ci"
        )
}

Invoke-CheckedCommand `
    -Name "Backend type-check" `
    -WorkingDirectory $Server `
    -Command "npm" `
    -Arguments @(
        "run",
        "type-check"
    )

Invoke-CheckedCommand `
    -Name "Backend tests" `
    -WorkingDirectory $Server `
    -Command "npm" `
    -Arguments @(
        "test"
    )

Invoke-CheckedCommand `
    -Name "Backend production build" `
    -WorkingDirectory $Server `
    -Command "npm" `
    -Arguments @(
        "run",
        "build"
    )

Invoke-CheckedCommand `
    -Name "Backend security audit" `
    -WorkingDirectory $Server `
    -Command "npm" `
    -Arguments @(
        "audit",
        "--audit-level=high"
    )

Write-Step "6. Frontend verification"

if (-not $SkipInstall) {
    Invoke-CheckedCommand `
        -Name "Frontend clean install" `
        -WorkingDirectory $Frontend `
        -Command "npm" `
        -Arguments @(
            "ci"
        )
}

Invoke-CheckedCommand `
    -Name "Frontend lint" `
    -WorkingDirectory $Frontend `
    -Command "npm" `
    -Arguments @(
        "run",
        "lint"
    )

Invoke-CheckedCommand `
    -Name "Frontend tests" `
    -WorkingDirectory $Frontend `
    -Command "npm" `
    -Arguments @(
        "test"
    )

Invoke-CheckedCommand `
    -Name "Frontend production build" `
    -WorkingDirectory $Frontend `
    -Command "npm" `
    -Arguments @(
        "run",
        "build"
    )

Invoke-CheckedCommand `
    -Name "Frontend security audit" `
    -WorkingDirectory $Frontend `
    -Command "npm" `
    -Arguments @(
        "audit",
        "--audit-level=high"
    )

Write-Step "7. Cleanup and summary"

Remove-Item `
    (Join-Path $Repo "frontend\dist") `
    -Recurse `
    -Force `
    -ErrorAction SilentlyContinue

Remove-Item `
    (Join-Path $Repo "server\dist") `
    -Recurse `
    -Force `
    -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Recent contributors:" `
    -ForegroundColor Cyan

& git -c core.pager=cat `
    shortlog -sne --all

if ($LASTEXITCODE -ne 0) {
    throw (
        "Contributor history could not " +
        "be read."
    )
}

Write-Host ""
Write-Host "Repository status:" `
    -ForegroundColor Cyan

& git status --short --branch

if ($LASTEXITCODE -ne 0) {
    throw (
        "Repository status could not " +
        "be read."
    )
}

Write-Host ""
Write-Host "========================================" `
    -ForegroundColor Green

Write-Host `
    " LEVEL 5 TECHNICAL VERIFICATION PASSED" `
    -ForegroundColor Green

Write-Host "========================================" `
    -ForegroundColor Green
