param(
    [string]$Identity = "chapter-pay-deployer",
    [string]$Network = "testnet",
    [int]$PricePerChapter = 5,
    [string]$TokenName = "Chapter Coin",
    [string]$TokenSymbol = "COIN",
    [int]$TokenDecimals = 0,
    [switch]$SkipInitialization
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$ContractRoot = Join-Path $RepoRoot "contracts\chapter-unlock"
$FrontendConfigPath = Join-Path `
    $RepoRoot `
    "frontend\public\contracts.json"

$ContractIdPath = Join-Path `
    $RepoRoot `
    "CONTRACT_ID.txt"

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Assert-NativeSuccess {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Step
    )

    if ($LASTEXITCODE -ne 0) {
        throw "$Step failed with exit code $LASTEXITCODE."
    }
}

function Read-ContractId {
    param(
        [Parameter(Mandatory = $true)]
        [object[]]$CommandOutput,

        [Parameter(Mandatory = $true)]
        [string]$ContractName
    )

    $OutputText = $CommandOutput -join "`n"

    $ContractMatch = [regex]::Match(
        $OutputText,
        'C[A-Z2-7]{55}'
    )

    if (-not $ContractMatch.Success) {
        Write-Host $OutputText -ForegroundColor Yellow

        throw "Could not read the deployed ID for $ContractName."
    }

    return $ContractMatch.Value
}

if ($PricePerChapter -le 0) {
    throw "PricePerChapter must be greater than zero."
}

if ($TokenDecimals -lt 0 -or $TokenDecimals -gt 18) {
    throw "TokenDecimals must be between 0 and 18."
}

Set-Location $RepoRoot

Write-Host "`n========================================" `
    -ForegroundColor Cyan

Write-Host " Stellar Chapter Pay Testnet Deployment" `
    -ForegroundColor Cyan

Write-Host "========================================" `
    -ForegroundColor Cyan

Write-Host "`n=== ENVIRONMENT ===" `
    -ForegroundColor Cyan

stellar --version
Assert-NativeSuccess "Reading Stellar CLI version"

rustc --version
Assert-NativeSuccess "Reading Rust version"

Write-Host "`n=== NETWORK ===" `
    -ForegroundColor Cyan

stellar network use $Network
Assert-NativeSuccess "Selecting Stellar network"

Write-Host "Network selected: $Network" `
    -ForegroundColor Green

Write-Host "`n=== DEPLOYER IDENTITY ===" `
    -ForegroundColor Cyan

$IdentityOutput = @(
    stellar keys address $Identity 2>$null
)

$IdentityExitCode = $LASTEXITCODE

if ($IdentityExitCode -ne 0 -or $IdentityOutput.Count -eq 0) {
    Write-Host `
        "Identity '$Identity' was not found. Creating and funding it..." `
        -ForegroundColor Yellow

    stellar keys generate `
        $Identity `
        --network $Network `
        --fund

    Assert-NativeSuccess "Creating deployer identity"

    $IdentityOutput = @(
        stellar keys address $Identity
    )

    Assert-NativeSuccess "Reading deployer address"
}

$AdminAddress = (
    $IdentityOutput |
    Select-Object -Last 1
).Trim()

if ($AdminAddress -notmatch '^G[A-Z2-7]{55}$') {
    throw "The deployer identity did not return a valid Stellar address."
}

Write-Host "Identity: $Identity" -ForegroundColor Green
Write-Host "Admin address: $AdminAddress" -ForegroundColor Green

Write-Host "`n=== CONTRACT VALIDATION ===" `
    -ForegroundColor Cyan

Set-Location $ContractRoot

cargo fmt --all -- --check
Assert-NativeSuccess "Contract formatting check"

cargo test --workspace --locked
Assert-NativeSuccess "Contract tests"

stellar contract build
Assert-NativeSuccess "Stellar contract build"

$TokenWasm = Join-Path `
    $ContractRoot `
    "target\wasm32v1-none\release\chapter_token.wasm"

$PaymentWasm = Join-Path `
    $ContractRoot `
    "target\wasm32v1-none\release\chapter_payment.wasm"

if (-not (Test-Path $TokenWasm -PathType Leaf)) {
    throw "Chapter Token WASM was not created: $TokenWasm"
}

if (-not (Test-Path $PaymentWasm -PathType Leaf)) {
    throw "Chapter Payment WASM was not created: $PaymentWasm"
}

Write-Host "Both WASM files are ready." `
    -ForegroundColor Green

$DeploymentTimestamp = Get-Date -Format "yyyyMMddHHmmss"

$TokenAlias = "chapter_token_$DeploymentTimestamp"
$PaymentAlias = "chapter_payment_$DeploymentTimestamp"

Write-Host "`n=== DEPLOY CHAPTER TOKEN ===" `
    -ForegroundColor Cyan

$TokenDeployOutput = @(
    stellar contract deploy `
        --wasm $TokenWasm `
        --source-account $Identity `
        --network $Network `
        --alias $TokenAlias `
        2>&1
)

$TokenDeployExitCode = $LASTEXITCODE

if ($TokenDeployExitCode -ne 0) {
    $TokenDeployOutput |
        ForEach-Object {
            Write-Host $_ -ForegroundColor Red
        }

    throw "Chapter Token deployment failed."
}

$TokenContractId = Read-ContractId `
    -CommandOutput $TokenDeployOutput `
    -ContractName "Chapter Token"

Write-Host "Chapter Token: $TokenContractId" `
    -ForegroundColor Green

Write-Host "`n=== DEPLOY CHAPTER PAYMENT ===" `
    -ForegroundColor Cyan

$PaymentDeployOutput = @(
    stellar contract deploy `
        --wasm $PaymentWasm `
        --source-account $Identity `
        --network $Network `
        --alias $PaymentAlias `
        2>&1
)

$PaymentDeployExitCode = $LASTEXITCODE

if ($PaymentDeployExitCode -ne 0) {
    $PaymentDeployOutput |
        ForEach-Object {
            Write-Host $_ -ForegroundColor Red
        }

    throw "Chapter Payment deployment failed."
}

$PaymentContractId = Read-ContractId `
    -CommandOutput $PaymentDeployOutput `
    -ContractName "Chapter Payment"

Write-Host "Chapter Payment: $PaymentContractId" `
    -ForegroundColor Green

if (-not $SkipInitialization) {
    Write-Host "`n=== INITIALIZE CHAPTER TOKEN ===" `
        -ForegroundColor Cyan

    stellar contract invoke `
        --id $TokenContractId `
        --source-account $Identity `
        --network $Network `
        --send yes `
        -- `
        initialize `
        --admin $AdminAddress `
        --name $TokenName `
        --symbol $TokenSymbol `
        --decimals $TokenDecimals

    Assert-NativeSuccess "Initializing Chapter Token"

    Write-Host "Chapter Token initialized." `
        -ForegroundColor Green

    Write-Host "`n=== INITIALIZE CHAPTER PAYMENT ===" `
        -ForegroundColor Cyan

    stellar contract invoke `
        --id $PaymentContractId `
        --source-account $Identity `
        --network $Network `
        --send yes `
        -- `
        initialize `
        --admin $AdminAddress `
        --token_contract $TokenContractId `
        --price_per_chapter $PricePerChapter

    Assert-NativeSuccess "Initializing Chapter Payment"

    Write-Host "Chapter Payment initialized." `
        -ForegroundColor Green

    Write-Host "`n=== READ DEPLOYED CONFIGURATION ===" `
        -ForegroundColor Cyan

    stellar contract invoke `
        --id $PaymentContractId `
        --source-account $Identity `
        --network $Network `
        --send no `
        -- `
        get_price_per_chapter

    Assert-NativeSuccess "Reading chapter price"
}

Write-Host "`n=== SAVE CONTRACT CONFIGURATION ===" `
    -ForegroundColor Cyan

$DeploymentTime = (
    Get-Date
).ToUniversalTime().ToString("o")

$FrontendConfig = [ordered]@{
    network = $Network.ToUpperInvariant()
    chapter_contract_id = $PaymentContractId
    token_contract_id = $TokenContractId
    updated_at = $DeploymentTime
}

$FrontendConfigJson = $FrontendConfig |
    ConvertTo-Json -Depth 4

$FrontendConfigDirectory = Split-Path `
    -Parent `
    $FrontendConfigPath

if (-not (Test-Path $FrontendConfigDirectory)) {
    New-Item `
        -ItemType Directory `
        -Path $FrontendConfigDirectory `
        -Force |
        Out-Null
}

[System.IO.File]::WriteAllText(
    $FrontendConfigPath,
    $FrontendConfigJson,
    $Utf8NoBom
)

$ContractIdLines = @(
    "NETWORK=$($Network.ToUpperInvariant())",
    "CHAPTER_PAYMENT_CONTRACT_ID=$PaymentContractId",
    "CHAPTER_TOKEN_CONTRACT_ID=$TokenContractId",
    "DEPLOYER_ADDRESS=$AdminAddress",
    "DEPLOYED_AT=$DeploymentTime"
)

[System.IO.File]::WriteAllLines(
    $ContractIdPath,
    $ContractIdLines,
    $Utf8NoBom
)

Write-Host "Updated frontend/public/contracts.json" `
    -ForegroundColor Green

Write-Host "Updated CONTRACT_ID.txt" `
    -ForegroundColor Green

Write-Host "`n========================================" `
    -ForegroundColor Green

Write-Host "Deployment completed successfully." `
    -ForegroundColor Green

Write-Host "Chapter Payment: $PaymentContractId" `
    -ForegroundColor Green

Write-Host "Chapter Token:   $TokenContractId" `
    -ForegroundColor Green

Write-Host "========================================" `
    -ForegroundColor Green

Set-Location $RepoRoot