#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Env, String, Symbol,
};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Name,
    Symbol,
    Decimals,
    Balance(Address),
    Claimed(Address),
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
    }

    pub fn faucet(env: Env, user: Address) {
        user.require_auth();

        let claimed_key = DataKey::Claimed(user.clone());
        if env.storage().persistent().has(&claimed_key) {
            panic!("demo tokens already claimed");
        }

        add_balance(&env, user.clone(), 100);
        env.storage().persistent().set(&claimed_key, &true);

        let event_name: Symbol = symbol_short!("faucet");
        env.events().publish((event_name, user), 100_i128);
    }

    pub fn mint(env: Env, to: Address, amount: i128) {
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

        let event_name: Symbol = symbol_short!("mint");
        env.events().publish((event_name, to), amount);
    }

    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        if amount <= 0 {
            panic!("amount must be positive");
        }

        from.require_auth();

        spend_balance(&env, from.clone(), amount);
        add_balance(&env, to.clone(), amount);

        let event_name: Symbol = symbol_short!("xfer");
        env.events().publish((event_name, from, to), amount);
    }

    pub fn balance(env: Env, user: Address) -> i128 {
        get_balance(&env, user)
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
            .unwrap_or(0)
    }
}

fn get_balance(env: &Env, user: Address) -> i128 {
    env.storage()
        .persistent()
        .get(&DataKey::Balance(user))
        .unwrap_or(0)
}

fn add_balance(env: &Env, user: Address, amount: i128) {
    let balance = get_balance(env, user.clone());
    let new_balance = balance + amount;
    env.storage()
        .persistent()
        .set(&DataKey::Balance(user), &new_balance);
}

fn spend_balance(env: &Env, user: Address, amount: i128) {
    let balance = get_balance(env, user.clone());

    if balance < amount {
        panic!("insufficient token balance");
    }

    let new_balance = balance - amount;
    env.storage()
        .persistent()
        .set(&DataKey::Balance(user), &new_balance);
}