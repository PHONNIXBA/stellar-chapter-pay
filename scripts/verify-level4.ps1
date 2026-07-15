param(
    [switch]$SkipInstall,
    [switch]$KeepArtifacts
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$ContractRoot = Join-Path $RepoRoot "contracts\chapter-unlock"
$FrontendRoot = Join-Path $RepoRoot "frontend"
$ServerRoot = Join-Path $RepoRoot "server"

function Invoke-NativeStep {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,

        [Parameter(Mandatory = $true)]
        [scriptblock]$Command
    )

    Write-Host "`n=== $Name ===" -ForegroundColor Cyan

    & $Command

    if ($LASTEXITCODE -ne 0) {
        throw "$Name failed with exit code $LASTEXITCODE."
    }

    Write-Host "$Name passed." -ForegroundColor Green
}

function Assert-FileExists {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RelativePath
    )

    $FullPath = Join-Path $RepoRoot $RelativePath

    if (-not (Test-Path $FullPath -PathType Leaf)) {
        throw "Required file is missing: $RelativePath"
    }

    if ((Get-Item $FullPath).Length -eq 0) {
        throw "Required file is empty: $RelativePath"
    }

    Write-Host "Found: $RelativePath" -ForegroundColor Green
}

Set-Location $RepoRoot

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host " Stellar Chapter Pay Level 4 Verification" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Write-Host "`n=== ENVIRONMENT ===" -ForegroundColor Cyan

node --version

if ($LASTEXITCODE -ne 0) {
    throw "Node.js is unavailable."
}

npm --version

if ($LASTEXITCODE -ne 0) {
    throw "npm is unavailable."
}

rustc --version

if ($LASTEXITCODE -ne 0) {
    throw "Rust is unavailable."
}

cargo --version

if ($LASTEXITCODE -ne 0) {
    throw "Cargo is unavailable."
}

stellar --version

if ($LASTEXITCODE -ne 0) {
    throw "Stellar CLI is unavailable."
}

git --version

if ($LASTEXITCODE -ne 0) {
    throw "Git is unavailable."
}

Write-Host "`n=== REPOSITORY ===" -ForegroundColor Cyan

$CurrentBranch = (git branch --show-current).Trim()

if ($LASTEXITCODE -ne 0 -or -not $CurrentBranch) {
    throw "Could not determine the current Git branch."
}

Write-Host "Branch: $CurrentBranch" -ForegroundColor Green

git remote -v

if ($LASTEXITCODE -ne 0) {
    throw "Could not read Git remotes."
}

git config user.name

if ($LASTEXITCODE -ne 0) {
    throw "Could not read Git user name."
}

git config user.email

if ($LASTEXITCODE -ne 0) {
    throw "Could not read Git user email."
}

Write-Host "`n=== REQUIRED FILES ===" -ForegroundColor Cyan

$RequiredFiles = @(
    ".github\workflows\ci.yml",
    "contracts\chapter-unlock\Cargo.toml",
    "contracts\chapter-unlock\Cargo.lock",
    "contracts\chapter-unlock\README.md",
    "contracts\chapter-unlock\contracts\chapter-payment\Cargo.toml",
    "contracts\chapter-unlock\contracts\chapter-payment\src\lib.rs",
    "contracts\chapter-unlock\contracts\chapter-payment\src\test.rs",
    "contracts\chapter-unlock\contracts\chapter-token\Cargo.toml",
    "contracts\chapter-unlock\contracts\chapter-token\src\lib.rs",
    "contracts\chapter-unlock\contracts\chapter-token\src\test.rs",
    "frontend\package.json",
    "frontend\package-lock.json",
    "frontend\vite.config.js",
    "frontend\index.html",
    "frontend\src\App.jsx",
    "frontend\src\App.css",
    "frontend\src\index.css",
    "frontend\src\contractConfig.js",
    "frontend\src\services\contract.js",
    "frontend\src\services\api.js",
    "frontend\src\services\analytics.js",
    "frontend\src\utils\cache.js",
    "frontend\src\utils\cache.test.js",
    "server\package.json",
    "server\package-lock.json",
    "server\index.ts",
    "server\index.test.ts",
    "server\tsconfig.json",
    "server\tsconfig.build.json",
    "server\vitest.config.ts",
    "server\services\contractService.ts",
    "server\services\dataService.ts",
    "docs\ARCHITECTURE.md",
    "docs\QUALITY_AND_DEPLOYMENT.md",
    "scripts\deploy-and-save.ps1",
    "scripts\verify-level4.ps1",
    "vercel.json",
    "railway.toml",
    "Procfile",
    "README.md",
    ".gitignore"
)

foreach ($RequiredFile in $RequiredFiles) {
    Assert-FileExists $RequiredFile
}

Write-Host "`n=== GENERATED FILE TRACKING CHECK ===" `
    -ForegroundColor Cyan

$TrackedFiles = @(git ls-files)

if ($LASTEXITCODE -ne 0) {
    throw "Could not read tracked Git files."
}

$TrackedGeneratedFiles = $TrackedFiles |
    Where-Object {
        $_ -match '(^|/)(node_modules|dist|target|\.vite)(/|$)' -or
        $_ -match 'test_snapshots' -or
        $_ -match '\.bak$' -or
        $_ -match 'version-check\.txt$' -or
        $_ -match 'deploy-output\.txt$' -or
        $_ -match 'deploy-stdout\.tmp$' -or
        $_ -match 'deploy-stderr\.tmp$'
    }

if ($TrackedGeneratedFiles) {
    $TrackedGeneratedFiles |
        ForEach-Object {
            Write-Host $_ -ForegroundColor Red
        }

    throw "Generated files are tracked by Git."
}

Write-Host "No generated files are tracked." `
    -ForegroundColor Green

Write-Host "`n=== OLD TEMPLATE REFERENCE CHECK ===" `
    -ForegroundColor Cyan

$OldReferences = @(
    git grep -n -I -E "hello-world|hello_world" -- . 2>$null
)

$OldReferenceExitCode = $LASTEXITCODE

if ($OldReferenceExitCode -eq 0) {
    $OldReferences |
        ForEach-Object {
            Write-Host $_ -ForegroundColor Red
        }

    throw "Old template references still exist."
}

if ($OldReferenceExitCode -gt 1) {
    throw "Could not complete the old template reference check."
}

Write-Host "No old template references found." `
    -ForegroundColor Green

Write-Host "`n=== PUBLIC WORDING CHECK ===" `
    -ForegroundColor Cyan

$PublicPaths = @(
    (Join-Path $RepoRoot "README.md"),
    (Join-Path $RepoRoot "contracts\chapter-unlock\README.md"),
    (Join-Path $RepoRoot "docs\*.md"),
    (Join-Path $RepoRoot ".github\workflows\*.yml"),
    (Join-Path $RepoRoot "scripts\deploy-and-save.ps1"),
    (Join-Path $RepoRoot "vercel.json"),
    (Join-Path $RepoRoot "railway.toml"),
    (Join-Path $RepoRoot "Procfile")
)

$RestrictedTerms = Select-String `
    -Path $PublicPaths `
    -Pattern "AI Review|AI_REVIEW|leak|judge checklist|ban giám khảo|hidden criteria|internal review" `
    -CaseSensitive:$false `
    -ErrorAction SilentlyContinue

if ($RestrictedTerms) {
    $RestrictedTerms |
        ForEach-Object {
            Write-Host $_ -ForegroundColor Red
        }

    throw "Restricted wording exists in public files."
}

Write-Host "Public wording check passed." `
    -ForegroundColor Green

Write-Host "`n=== DEPLOYMENT CONFIGURATION ===" `
    -ForegroundColor Cyan

$VercelPath = Join-Path $RepoRoot "vercel.json"

try {
    Get-Content $VercelPath -Raw |
        ConvertFrom-Json |
        Out-Null
}
catch {
    throw "vercel.json is not valid JSON."
}

$RailwayPath = Join-Path $RepoRoot "railway.toml"
$RailwayContent = Get-Content $RailwayPath -Raw

$RailwayRequirements = @(
    'builder = "RAILPACK"',
    'buildCommand',
    'startCommand',
    'healthcheckPath = "/health"'
)

foreach ($Requirement in $RailwayRequirements) {
    if (-not $RailwayContent.Contains($Requirement)) {
        throw "railway.toml is missing: $Requirement"
    }
}

$ProcfilePath = Join-Path $RepoRoot "Procfile"
$ProcfileContent = Get-Content $ProcfilePath -Raw

if (-not $ProcfileContent.Trim().StartsWith("web:")) {
    throw "Procfile does not contain a web process."
}

Write-Host "Deployment configuration passed." `
    -ForegroundColor Green

Write-Host "`n=== CI CONFIGURATION ===" `
    -ForegroundColor Cyan

$CiPath = Join-Path $RepoRoot ".github\workflows\ci.yml"
$CiContent = Get-Content $CiPath -Raw

$RequiredCiJobs = @(
    "smart-contract:",
    "frontend:",
    "backend:",
    "deployment-config:"
)

foreach ($RequiredCiJob in $RequiredCiJobs) {
    if (-not $CiContent.Contains($RequiredCiJob)) {
        throw "CI workflow is missing job: $RequiredCiJob"
    }
}

$OldCiConfiguration = Select-String `
    -Path $CiPath `
    -Pattern "actions/checkout@v4|actions/setup-node@v4|node-version:\s*20" `
    -CaseSensitive:$false

if ($OldCiConfiguration) {
    $OldCiConfiguration |
        ForEach-Object {
            Write-Host $_ -ForegroundColor Red
        }

    throw "CI workflow contains outdated action or Node.js configuration."
}

Write-Host "CI configuration passed." `
    -ForegroundColor Green

Set-Location $ContractRoot

Invoke-NativeStep `
    "CONTRACT FORMAT" `
    {
        cargo fmt --all -- --check
    }

Invoke-NativeStep `
    "CONTRACT WASM CHECK" `
    {
        cargo check `
            --workspace `
            --locked `
            --target wasm32v1-none
    }

Invoke-NativeStep `
    "CONTRACT TESTS" `
    {
        cargo test `
            --workspace `
            --locked
    }

Invoke-NativeStep `
    "CONTRACT RELEASE BUILD" `
    {
        cargo build `
            --workspace `
            --locked `
            --target wasm32v1-none `
            --release
    }

Invoke-NativeStep `
    "STELLAR CONTRACT BUILD" `
    {
        stellar contract build
    }

$ExpectedWasmFiles = @(
    "target\wasm32v1-none\release\chapter_payment.wasm",
    "target\wasm32v1-none\release\chapter_token.wasm"
)

foreach ($WasmFile in $ExpectedWasmFiles) {
    $WasmPath = Join-Path $ContractRoot $WasmFile

    if (-not (Test-Path $WasmPath -PathType Leaf)) {
        throw "Expected WASM file was not created: $WasmFile"
    }

    Write-Host "Built: $WasmFile" -ForegroundColor Green
}

Set-Location $FrontendRoot

if (-not $SkipInstall) {
    Invoke-NativeStep `
        "FRONTEND INSTALL" `
        {
            npm ci --no-fund
        }
}

Invoke-NativeStep `
    "FRONTEND LINT" `
    {
        npm run lint
    }

Invoke-NativeStep `
    "FRONTEND TESTS" `
    {
        npm test
    }

Invoke-NativeStep `
    "FRONTEND BUILD" `
    {
        npm run build
    }

Invoke-NativeStep `
    "FRONTEND SECURITY AUDIT" `
    {
        npm audit
    }

Set-Location $ServerRoot

if (-not $SkipInstall) {
    Invoke-NativeStep `
        "BACKEND INSTALL" `
        {
            npm ci --no-fund
        }
}

Invoke-NativeStep `
    "BACKEND TYPE CHECK" `
    {
        npm run type-check
    }

Invoke-NativeStep `
    "BACKEND TESTS" `
    {
        npm test
    }

Invoke-NativeStep `
    "BACKEND BUILD" `
    {
        npm run build
    }

Invoke-NativeStep `
    "BACKEND SECURITY AUDIT" `
    {
        npm audit
    }

Set-Location $RepoRoot

Invoke-NativeStep `
    "GIT DIFF CHECK" `
    {
        git diff --check
    }

if (-not $KeepArtifacts) {
    Write-Host "`n=== CLEAN GENERATED OUTPUT ===" `
        -ForegroundColor Cyan

    Remove-Item `
        (Join-Path $FrontendRoot "dist") `
        -Recurse `
        -Force `
        -ErrorAction SilentlyContinue

    Remove-Item `
        (Join-Path $FrontendRoot ".vite") `
        -Recurse `
        -Force `
        -ErrorAction SilentlyContinue

    Remove-Item `
        (Join-Path $ServerRoot "dist") `
        -Recurse `
        -Force `
        -ErrorAction SilentlyContinue

    Get-ChildItem `
        (Join-Path $ContractRoot "contracts") `
        -Directory `
        -Recurse `
        -Filter "test_snapshots" `
        -ErrorAction SilentlyContinue |
        Remove-Item `
            -Recurse `
            -Force `
            -ErrorAction SilentlyContinue

    Write-Host "Generated application output removed." `
        -ForegroundColor Green
}

Write-Host "`n=== FINAL GIT STATUS ===" `
    -ForegroundColor Cyan

git status --short

Write-Host "`n========================================" `
    -ForegroundColor Green

Write-Host "Level 4 local verification passed." `
    -ForegroundColor Green

Write-Host "========================================" `
    -ForegroundColor Green