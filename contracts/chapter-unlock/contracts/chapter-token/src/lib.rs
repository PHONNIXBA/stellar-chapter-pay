#![no_std]

#[cfg(test)]
mod test;

use soroban_sdk::{contract, contractevent, contractimpl, contracttype, Address, Env, String};

const FAUCET_AMOUNT: i128 = 100;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Admin,
    Name,
    Symbol,
    Decimals,
    TotalSupply,
    Balance(Address),
    Claimed(Address),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TokenStats {
    pub total_supply: i128,
    pub faucet_amount: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct InitializedEvent {
    #[topic]
    pub admin: Address,

    pub decimals: u32,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FaucetClaimedEvent {
    #[topic]
    pub user: Address,

    pub amount: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TokensMintedEvent {
    #[topic]
    pub to: Address,

    pub amount: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TokensTransferredEvent {
    #[topic]
    pub from: Address,

    #[topic]
    pub to: Address,

    pub amount: i128,
}

#[contract]
pub struct ChapterTokenContract;

#[contractimpl]
impl ChapterTokenContract {
    pub fn initialize(env: Env, admin: Address, name: String, symbol: String, decimals: u32) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("token already initialized");
        }

        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);

        env.storage().instance().set(&DataKey::Name, &name);

        env.storage().instance().set(&DataKey::Symbol, &symbol);

        env.storage().instance().set(&DataKey::Decimals, &decimals);

        env.storage()
            .persistent()
            .set(&DataKey::TotalSupply, &0_i128);

        InitializedEvent { admin, decimals }.publish(&env);
    }

    pub fn faucet(env: Env, user: Address) {
        ensure_initialized(&env);

        user.require_auth();

        let claimed_key = DataKey::Claimed(user.clone());

        let already_claimed: bool = env
            .storage()
            .persistent()
            .get(&claimed_key)
            .unwrap_or(false);

        if already_claimed {
            panic!("demo tokens already claimed");
        }

        add_balance(&env, user.clone(), FAUCET_AMOUNT);

        increase_total_supply(&env, FAUCET_AMOUNT);

        env.storage().persistent().set(&claimed_key, &true);

        FaucetClaimedEvent {
            user,
            amount: FAUCET_AMOUNT,
        }
        .publish(&env);
    }

    pub fn mint(env: Env, to: Address, amount: i128) {
        ensure_initialized(&env);

        if amount <= 0 {
            panic!("amount must be positive");
        }

        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic!("token not initialized"));

        admin.require_auth();

        add_balance(&env, to.clone(), amount);

        increase_total_supply(&env, amount);

        TokensMintedEvent { to, amount }.publish(&env);
    }

    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        ensure_initialized(&env);

        if amount <= 0 {
            panic!("amount must be positive");
        }

        from.require_auth();

        spend_balance(&env, from.clone(), amount);

        add_balance(&env, to.clone(), amount);

        TokensTransferredEvent { from, to, amount }.publish(&env);
    }

    pub fn balance(env: Env, user: Address) -> i128 {
        get_balance(&env, user)
    }

    pub fn has_claimed(env: Env, user: Address) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::Claimed(user))
            .unwrap_or(false)
    }

    pub fn name(env: Env) -> String {
        env.storage()
            .instance()
            .get(&DataKey::Name)
            .unwrap_or_else(|| panic!("token not initialized"))
    }

    pub fn symbol(env: Env) -> String {
        env.storage()
            .instance()
            .get(&DataKey::Symbol)
            .unwrap_or_else(|| panic!("token not initialized"))
    }

    pub fn decimals(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::Decimals)
            .unwrap_or_else(|| panic!("token not initialized"))
    }

    pub fn admin(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic!("token not initialized"))
    }

    pub fn total_supply(env: Env) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0)
    }

    pub fn get_stats(env: Env) -> TokenStats {
        TokenStats {
            total_supply: Self::total_supply(env),
            faucet_amount: FAUCET_AMOUNT,
        }
    }
}

fn ensure_initialized(env: &Env) {
    if !env.storage().instance().has(&DataKey::Admin) {
        panic!("token not initialized");
    }
}

fn get_balance(env: &Env, user: Address) -> i128 {
    env.storage()
        .persistent()
        .get(&DataKey::Balance(user))
        .unwrap_or(0)
}

fn add_balance(env: &Env, user: Address, amount: i128) {
    let current_balance = get_balance(env, user.clone());

    let new_balance = current_balance
        .checked_add(amount)
        .unwrap_or_else(|| panic!("balance overflow"));

    env.storage()
        .persistent()
        .set(&DataKey::Balance(user), &new_balance);
}

fn spend_balance(env: &Env, user: Address, amount: i128) {
    let current_balance = get_balance(env, user.clone());

    if current_balance < amount {
        panic!("insufficient token balance");
    }

    let new_balance = current_balance - amount;

    env.storage()
        .persistent()
        .set(&DataKey::Balance(user), &new_balance);
}

fn increase_total_supply(env: &Env, amount: i128) {
    let current_supply: i128 = env
        .storage()
        .persistent()
        .get(&DataKey::TotalSupply)
        .unwrap_or(0);

    let new_supply = current_supply
        .checked_add(amount)
        .unwrap_or_else(|| panic!("total supply overflow"));

    env.storage()
        .persistent()
        .set(&DataKey::TotalSupply, &new_supply);
}
