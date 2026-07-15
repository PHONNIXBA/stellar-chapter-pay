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

$Utf8NoBom = New-Object `
    System.Text.UTF8Encoding($false)

function Assert-NativeSuccess {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Step
    )

    if ($LASTEXITCODE -ne 0) {
        throw "$Step failed with exit code $LASTEXITCODE."
    }
}

function Invoke-StellarCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments,

        [Parameter(Mandatory = $true)]
        [string]$Step,

        [switch]$AllowFailure
    )

    $PreviousErrorActionPreference =
        $ErrorActionPreference

    try {
        $ErrorActionPreference = "Continue"

        $CommandOutput = @(
            & stellar @Arguments 2>&1
        )

        $CommandExitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference =
            $PreviousErrorActionPreference
    }

    $OutputLines = @(
        $CommandOutput |
        ForEach-Object {
            $_.ToString()
        }
    )

    $OutputText = (
        $OutputLines -join
        [Environment]::NewLine
    ).Trim()

    if (
        $CommandExitCode -ne 0 -and
        -not $AllowFailure
    ) {
        if ($OutputText) {
            Write-Host `
                $OutputText `
                -ForegroundColor Red
        }

        throw (
            "$Step failed with exit code " +
            "$CommandExitCode."
        )
    }

    return [PSCustomObject]@{
        ExitCode = $CommandExitCode
        Lines = $OutputLines
        Text = $OutputText
    }
}

function Get-DeployedContractId {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Output,

        [Parameter(Mandatory = $true)]
        [string]$ContractName
    )

    $ContractMatch = [regex]::Match(
        $Output,
        '\bC[A-Z2-7]{55}\b'
    )

    if (-not $ContractMatch.Success) {
        if ($Output) {
            Write-Host `
                $Output `
                -ForegroundColor Yellow
        }

        throw (
            "Could not read the deployed ID for " +
            "$ContractName."
        )
    }

    return $ContractMatch.Value
}

function Assert-ValidStellarAddress {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Address,

        [Parameter(Mandatory = $true)]
        [string]$Label
    )

    if (
        $Address -notmatch
        '^G[A-Z2-7]{55}$'
    ) {
        throw "$Label is not a valid Stellar address."
    }
}

function Assert-ValidContractId {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ContractId,

        [Parameter(Mandatory = $true)]
        [string]$Label
    )

    if (
        $ContractId -notmatch
        '^C[A-Z2-7]{55}$'
    ) {
        throw "$Label is not a valid Stellar contract ID."
    }
}

if ([string]::IsNullOrWhiteSpace($Identity)) {
    throw "Identity cannot be empty."
}

if ([string]::IsNullOrWhiteSpace($Network)) {
    throw "Network cannot be empty."
}

if ($PricePerChapter -le 0) {
    throw "PricePerChapter must be greater than zero."
}

if (
    $TokenDecimals -lt 0 -or
    $TokenDecimals -gt 18
) {
    throw "TokenDecimals must be between 0 and 18."
}

if ([string]::IsNullOrWhiteSpace($TokenName)) {
    throw "TokenName cannot be empty."
}

if ([string]::IsNullOrWhiteSpace($TokenSymbol)) {
    throw "TokenSymbol cannot be empty."
}

Set-Location $RepoRoot

Write-Host `
    "`n========================================" `
    -ForegroundColor Cyan

Write-Host `
    " Stellar Chapter Pay Testnet Deployment" `
    -ForegroundColor Cyan

Write-Host `
    "========================================" `
    -ForegroundColor Cyan

Write-Host "`n=== ENVIRONMENT ===" `
    -ForegroundColor Cyan

stellar --version
Assert-NativeSuccess "Reading Stellar CLI version"

rustc --version
Assert-NativeSuccess "Reading Rust version"

cargo --version
Assert-NativeSuccess "Reading Cargo version"

Write-Host "`n=== NETWORK ===" `
    -ForegroundColor Cyan

$NetworkResult = Invoke-StellarCommand `
    -Arguments @(
        "-q",
        "network",
        "use",
        $Network
    ) `
    -Step "Selecting Stellar network"

if ($NetworkResult.Text) {
    Write-Host $NetworkResult.Text
}

Write-Host `
    "Network selected: $Network" `
    -ForegroundColor Green

Write-Host "`n=== DEPLOYER IDENTITY ===" `
    -ForegroundColor Cyan

$IdentityListResult = Invoke-StellarCommand `
    -Arguments @(
        "-q",
        "keys",
        "ls"
    ) `
    -Step "Listing Stellar identities"

$IdentityPattern = (
    "(?m)(^|\s)" +
    [regex]::Escape($Identity) +
    "(\s|$)"
)

$IdentityExists = (
    $IdentityListResult.Text -match
    $IdentityPattern
)

if (-not $IdentityExists) {
    Write-Host `
        "Identity '$Identity' was not found." `
        -ForegroundColor Yellow

    Write-Host `
        "Creating and funding a new Testnet identity..." `
        -ForegroundColor Yellow

    $GenerateIdentityResult =
        Invoke-StellarCommand `
            -Arguments @(
                "-q",
                "keys",
                "generate",
                $Identity,
                "--network",
                $Network,
                "--fund"
            ) `
            -Step "Creating deployer identity"

    if ($GenerateIdentityResult.Text) {
        Write-Host $GenerateIdentityResult.Text
    }

    Write-Host `
        "Identity created and funded." `
        -ForegroundColor Green
}
else {
    Write-Host `
        "Existing identity found: $Identity" `
        -ForegroundColor Green
}

$AddressResult = Invoke-StellarCommand `
    -Arguments @(
        "-q",
        "keys",
        "address",
        $Identity
    ) `
    -Step "Reading deployer address"

$AdminAddressMatch = [regex]::Match(
    $AddressResult.Text,
    '\bG[A-Z2-7]{55}\b'
)

if (-not $AdminAddressMatch.Success) {
    Write-Host `
        $AddressResult.Text `
        -ForegroundColor Yellow

    throw "Could not read the deployer address."
}

$AdminAddress = $AdminAddressMatch.Value

Assert-ValidStellarAddress `
    -Address $AdminAddress `
    -Label "Deployer address"

Write-Host `
    "Identity: $Identity" `
    -ForegroundColor Green

Write-Host `
    "Admin address: $AdminAddress" `
    -ForegroundColor Green

Write-Host "`n=== CONTRACT VALIDATION ===" `
    -ForegroundColor Cyan

Set-Location $ContractRoot

cargo fmt --all -- --check
Assert-NativeSuccess "Contract formatting check"

cargo test --workspace --locked
Assert-NativeSuccess "Contract tests"

$BuildResult = Invoke-StellarCommand `
    -Arguments @(
        "contract",
        "build"
    ) `
    -Step "Stellar contract build"

if ($BuildResult.Text) {
    Write-Host $BuildResult.Text
}

$TokenWasm = Join-Path `
    $ContractRoot `
    "target\wasm32v1-none\release\chapter_token.wasm"

$PaymentWasm = Join-Path `
    $ContractRoot `
    "target\wasm32v1-none\release\chapter_payment.wasm"

if (-not (Test-Path $TokenWasm -PathType Leaf)) {
    throw (
        "Chapter Token WASM was not created: " +
        $TokenWasm
    )
}

if (-not (Test-Path $PaymentWasm -PathType Leaf)) {
    throw (
        "Chapter Payment WASM was not created: " +
        $PaymentWasm
    )
}

Write-Host `
    "Both WASM files are ready." `
    -ForegroundColor Green

$DeploymentTimestamp =
    Get-Date -Format "yyyyMMddHHmmss"

$TokenAlias =
    "chapter_token_$DeploymentTimestamp"

$PaymentAlias =
    "chapter_payment_$DeploymentTimestamp"

Write-Host "`n=== DEPLOY CHAPTER TOKEN ===" `
    -ForegroundColor Cyan

$TokenDeployResult =
    Invoke-StellarCommand `
        -Arguments @(
            "-q",
            "contract",
            "deploy",
            "--wasm",
            $TokenWasm,
            "--source-account",
            $Identity,
            "--network",
            $Network,
            "--alias",
            $TokenAlias
        ) `
        -Step "Deploying Chapter Token"

$TokenContractId =
    Get-DeployedContractId `
        -Output $TokenDeployResult.Text `
        -ContractName "Chapter Token"

Assert-ValidContractId `
    -ContractId $TokenContractId `
    -Label "Chapter Token contract ID"

Write-Host `
    "Chapter Token: $TokenContractId" `
    -ForegroundColor Green

Write-Host "`n=== DEPLOY CHAPTER PAYMENT ===" `
    -ForegroundColor Cyan

$PaymentDeployResult =
    Invoke-StellarCommand `
        -Arguments @(
            "-q",
            "contract",
            "deploy",
            "--wasm",
            $PaymentWasm,
            "--source-account",
            $Identity,
            "--network",
            $Network,
            "--alias",
            $PaymentAlias
        ) `
        -Step "Deploying Chapter Payment"

$PaymentContractId =
    Get-DeployedContractId `
        -Output $PaymentDeployResult.Text `
        -ContractName "Chapter Payment"

Assert-ValidContractId `
    -ContractId $PaymentContractId `
    -Label "Chapter Payment contract ID"

Write-Host `
    "Chapter Payment: $PaymentContractId" `
    -ForegroundColor Green

if (-not $SkipInitialization) {
    Write-Host `
        "`n=== INITIALIZE CHAPTER TOKEN ===" `
        -ForegroundColor Cyan

    $TokenInitializeResult =
        Invoke-StellarCommand `
            -Arguments @(
                "-q",
                "contract",
                "invoke",
                "--id",
                $TokenContractId,
                "--source-account",
                $Identity,
                "--network",
                $Network,
                "--send=yes",
                "--",
                "initialize",
                "--admin",
                $AdminAddress,
                "--name",
                $TokenName,
                "--symbol",
                $TokenSymbol,
                "--decimals",
                $TokenDecimals.ToString()
            ) `
            -Step "Initializing Chapter Token"

    if ($TokenInitializeResult.Text) {
        Write-Host $TokenInitializeResult.Text
    }

    Write-Host `
        "Chapter Token initialized." `
        -ForegroundColor Green

    Write-Host `
        "`n=== INITIALIZE CHAPTER PAYMENT ===" `
        -ForegroundColor Cyan

    $PaymentInitializeResult =
        Invoke-StellarCommand `
            -Arguments @(
                "-q",
                "contract",
                "invoke",
                "--id",
                $PaymentContractId,
                "--source-account",
                $Identity,
                "--network",
                $Network,
                "--send=yes",
                "--",
                "initialize",
                "--admin",
                $AdminAddress,
                "--token_contract",
                $TokenContractId,
                "--price_per_chapter",
                $PricePerChapter.ToString()
            ) `
            -Step "Initializing Chapter Payment"

    if ($PaymentInitializeResult.Text) {
        Write-Host $PaymentInitializeResult.Text
    }

    Write-Host `
        "Chapter Payment initialized." `
        -ForegroundColor Green

    Write-Host `
        "`n=== VERIFY DEPLOYED CONFIGURATION ===" `
        -ForegroundColor Cyan

    $PriceResult = Invoke-StellarCommand `
        -Arguments @(
            "-q",
            "contract",
            "invoke",
            "--id",
            $PaymentContractId,
            "--source-account",
            $Identity,
            "--network",
            $Network,
            "--",
            "get_price_per_chapter"
        ) `
        -Step "Reading chapter price"

    if ($PriceResult.Text) {
        Write-Host `
            "Price per chapter: $($PriceResult.Text)" `
            -ForegroundColor Green
    }

    $TokenStatsResult =
        Invoke-StellarCommand `
            -Arguments @(
                "-q",
                "contract",
                "invoke",
                "--id",
                $TokenContractId,
                "--source-account",
                $Identity,
                "--network",
                $Network,
                "--",
                "get_stats"
            ) `
            -Step "Reading token statistics"

    if ($TokenStatsResult.Text) {
        Write-Host `
            "Token stats: $($TokenStatsResult.Text)" `
            -ForegroundColor Green
    }
}

Write-Host `
    "`n=== SAVE CONTRACT CONFIGURATION ===" `
    -ForegroundColor Cyan

$DeploymentTime = (
    Get-Date
).ToUniversalTime().ToString("o")

$FrontendConfig = [ordered]@{
    network =
        $Network.ToUpperInvariant()

    chapter_contract_id =
        $PaymentContractId

    token_contract_id =
        $TokenContractId

    updated_at =
        $DeploymentTime
}

$FrontendConfigJson =
    $FrontendConfig |
    ConvertTo-Json -Depth 4

$FrontendConfigDirectory =
    Split-Path `
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

Write-Host `
    "Updated frontend/public/contracts.json" `
    -ForegroundColor Green

Write-Host `
    "Updated CONTRACT_ID.txt" `
    -ForegroundColor Green

Write-Host `
    "`n========================================" `
    -ForegroundColor Green

Write-Host `
    "Deployment completed successfully." `
    -ForegroundColor Green

Write-Host `
    "Chapter Payment: $PaymentContractId" `
    -ForegroundColor Green

Write-Host `
    "Chapter Token:   $TokenContractId" `
    -ForegroundColor Green

Write-Host `
    "========================================" `
    -ForegroundColor Green

Set-Location $RepoRoot