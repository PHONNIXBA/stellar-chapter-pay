# Stellar Chapter Pay Contracts

This workspace contains the Soroban smart contracts used by Stellar Chapter Pay.

The contracts implement a token-based chapter purchase flow on Stellar. Users receive or hold Chapter Coin, then spend those tokens through the chapter payment contract to unlock digital chapters.

## Contract Structure

    chapter-unlock
    |-- contracts
    |   |-- chapter-payment
    |   |   |-- Cargo.toml
    |   |   `-- src
    |   |       |-- lib.rs
    |   |       `-- test.rs
    |   `-- chapter-token
    |       |-- Cargo.toml
    |       `-- src
    |           |-- lib.rs
    |           `-- test.rs
    |-- Cargo.toml
    |-- Cargo.lock
    `-- README.md

## Chapter Token

The `chapter-token` contract manages the utility token used for chapter purchases.

Main capabilities:

- Initialize token metadata and administrator.
- Claim a limited demo token allocation.
- Mint tokens through administrator authorization.
- Transfer tokens between Stellar addresses.
- Read account balances and token metadata.
- Track total token supply.
- Track whether an address has claimed demo tokens.
- Publish typed Soroban contract events.
- Return aggregate token statistics.

Main functions:

- `initialize`
- `faucet`
- `mint`
- `transfer`
- `balance`
- `has_claimed`
- `name`
- `symbol`
- `decimals`
- `admin`
- `total_supply`
- `get_stats`

## Chapter Payment

The `chapter-payment` contract processes chapter purchases and communicates with the Chapter Token contract.

Main capabilities:

- Configure the administrator, token contract, and chapter price.
- Purchase multiple chapters in one transaction.
- Transfer Chapter Coin through an inter-contract call.
- Store individual payment records.
- Track unlocked chapters by user.
- Track total payments, unlocked chapters, and revenue.
- Update the chapter price through administrator authorization.
- Pause or resume new payments.
- Publish typed Soroban contract events.
- Return payment records and aggregate statistics.

Main functions:

- `initialize`
- `unlock_with_payment`
- `update_price`
- `set_paused`
- `get_unlocked_count`
- `is_unlocked`
- `get_price_per_chapter`
- `get_total_price`
- `get_token_contract`
- `get_admin`
- `is_paused`
- `get_payment`
- `get_stats`

## Payment Flow

1. The user authorizes a chapter purchase.
2. The Chapter Payment contract calculates the total price.
3. The Chapter Payment contract calls the Chapter Token contract.
4. Chapter Coin is transferred from the user to the payment contract.
5. A payment record is stored in persistent storage.
6. The user's unlocked chapter count is updated.
7. Aggregate payment statistics are updated.
8. A typed purchase event is published.

## Local Validation

Run the following commands from `contracts/chapter-unlock`:

    cargo fmt --all -- --check
    cargo check --workspace --target wasm32v1-none
    cargo test --workspace
    cargo build --workspace --target wasm32v1-none --release

The workspace includes automated tests for:

- Token initialization and metadata.
- Faucet claims and token balances.
- Token minting and transfers.
- Payment processing.
- Inter-contract token transfers.
- Payment records and statistics.
- Price administration.
- Pause and resume controls.
- Invalid quantities and insufficient balances.

## Generated Files

Generated build files such as `target`, local Stellar files, and contract test snapshots are excluded from version control.