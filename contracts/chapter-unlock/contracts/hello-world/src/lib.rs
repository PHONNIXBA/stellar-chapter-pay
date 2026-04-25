#![no_std]

use soroban_sdk::{
    contract, contractclient, contractimpl, contracttype, symbol_short, Address, Env, Symbol,
};

#[contractclient(name = "ChapterTokenClient")]
pub trait ChapterTokenContractTrait {
    fn transfer(env: Env, from: Address, to: Address, amount: i128);
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    TokenContract,
    PricePerChapter,
    UnlockedCount(Address),
}

#[contract]
pub struct ChapterUnlockContract;

#[contractimpl]
impl ChapterUnlockContract {
    pub fn initialize(env: Env, admin: Address, token_contract: Address, price_per_chapter: i128) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("chapter contract already initialized");
        }

        if price_per_chapter <= 0 {
            panic!("price per chapter must be positive");
        }

        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::TokenContract, &token_contract);
        env.storage()
            .instance()
            .set(&DataKey::PricePerChapter, &price_per_chapter);
    }

    pub fn unlock_with_payment(env: Env, user: Address, quantity: u32) {
        user.require_auth();

        if quantity == 0 {
            panic!("quantity must be greater than zero");
        }

        let token_contract: Address = env
            .storage()
            .instance()
            .get(&DataKey::TokenContract)
            .unwrap_or_else(|| panic!("token contract not set"));

        let price_per_chapter: i128 = env
            .storage()
            .instance()
            .get(&DataKey::PricePerChapter)
            .unwrap_or_else(|| panic!("price per chapter not set"));

        let total_price = price_per_chapter * quantity as i128;

        let this_contract = env.current_contract_address();
        let token_client = ChapterTokenClient::new(&env, &token_contract);

        token_client.transfer(&user, &this_contract, &total_price);

        let key = DataKey::UnlockedCount(user.clone());
        let current_count: u32 = env.storage().persistent().get(&key).unwrap_or(0);
        let new_count = current_count + quantity;

        env.storage().persistent().set(&key, &new_count);

        let event_name: Symbol = symbol_short!("unlockqty");
        env.events().publish((event_name, user), (quantity, total_price));
    }

    pub fn get_unlocked_count(env: Env, user: Address) -> u32 {
        let key = DataKey::UnlockedCount(user);
        env.storage().persistent().get(&key).unwrap_or(0)
    }

    pub fn is_unlocked(env: Env, user: Address) -> bool {
        Self::get_unlocked_count(env, user) > 0
    }

    pub fn get_price_per_chapter(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::PricePerChapter)
            .unwrap_or_else(|| panic!("price per chapter not set"))
    }

    pub fn get_total_price(env: Env, quantity: u32) -> i128 {
        if quantity == 0 {
            panic!("quantity must be greater than zero");
        }

        let price_per_chapter: i128 = env
            .storage()
            .instance()
            .get(&DataKey::PricePerChapter)
            .unwrap_or_else(|| panic!("price per chapter not set"));

        price_per_chapter * quantity as i128
    }

    pub fn get_token_contract(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::TokenContract)
            .unwrap_or_else(|| panic!("token contract not set"))
    }
}