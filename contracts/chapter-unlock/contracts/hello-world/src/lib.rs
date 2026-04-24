#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env, Symbol};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Unlocked(Address),
}

#[contract]
pub struct ChapterUnlockContract;

#[contractimpl]
impl ChapterUnlockContract {
    pub fn unlock(env: Env, user: Address) {
        user.require_auth();

        let key = DataKey::Unlocked(user.clone());

        if env.storage().persistent().has(&key) {
            panic!("chapter already unlocked");
        }

        env.storage().persistent().set(&key, &true);

        let event_name: Symbol = symbol_short!("unlock");
        env.events().publish((event_name, user), true);
    }

    pub fn is_unlocked(env: Env, user: Address) -> bool {
        let key = DataKey::Unlocked(user);

        env.storage()
            .persistent()
            .get::<DataKey, bool>(&key)
            .unwrap_or(false)
    }
}