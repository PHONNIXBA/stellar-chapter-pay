#![no_std]

#[cfg(test)]
mod test;

use soroban_sdk::{
    contract, contractclient, contracterror, contractevent, contractimpl, contracttype, Address,
    Env,
};

#[contractclient(name = "ChapterTokenClient")]
pub trait ChapterTokenInterface {
    fn transfer(env: Env, from: Address, to: Address, amount: i128);
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PaymentRecord {
    pub payment_id: u64,
    pub user: Address,
    pub quantity: u32,
    pub unit_price: i128,
    pub total_price: i128,
    pub ledger: u32,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PaymentStats {
    pub payment_count: u64,
    pub total_chapters_unlocked: u64,
    pub total_revenue: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Admin,
    TokenContract,
    PricePerChapter,
    Paused,
    UnlockedCount(Address),
    PaymentCount,
    Payment(u64),
    TotalChaptersUnlocked,
    TotalRevenue,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum ContractError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    InvalidPrice = 4,
    InvalidQuantity = 5,
    ContractPaused = 6,
    ArithmeticOverflow = 7,
    PaymentNotFound = 8,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct InitializedEvent {
    #[topic]
    pub admin: Address,

    pub token_contract: Address,
    pub price_per_chapter: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ChapterPurchasedEvent {
    #[topic]
    pub payment_id: u64,

    #[topic]
    pub user: Address,

    pub quantity: u32,
    pub total_price: i128,
    pub unlocked_count: u32,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PriceUpdatedEvent {
    #[topic]
    pub admin: Address,

    pub previous_price: i128,
    pub new_price: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PauseUpdatedEvent {
    #[topic]
    pub admin: Address,

    pub paused: bool,
}

#[contract]
pub struct ChapterPaymentContract;

#[contractimpl]
impl ChapterPaymentContract {
    pub fn initialize(
        env: Env,
        admin: Address,
        token_contract: Address,
        price_per_chapter: i128,
    ) -> Result<(), ContractError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(ContractError::AlreadyInitialized);
        }

        if price_per_chapter <= 0 {
            return Err(ContractError::InvalidPrice);
        }

        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);

        env.storage()
            .instance()
            .set(&DataKey::TokenContract, &token_contract);

        env.storage()
            .instance()
            .set(&DataKey::PricePerChapter, &price_per_chapter);

        env.storage().instance().set(&DataKey::Paused, &false);

        env.storage()
            .persistent()
            .set(&DataKey::PaymentCount, &0_u64);

        env.storage()
            .persistent()
            .set(&DataKey::TotalChaptersUnlocked, &0_u64);

        env.storage()
            .persistent()
            .set(&DataKey::TotalRevenue, &0_i128);

        InitializedEvent {
            admin,
            token_contract,
            price_per_chapter,
        }
        .publish(&env);

        Ok(())
    }

    pub fn unlock_with_payment(
        env: Env,
        user: Address,
        quantity: u32,
    ) -> Result<PaymentRecord, ContractError> {
        ensure_initialized(&env)?;

        if is_contract_paused(&env) {
            return Err(ContractError::ContractPaused);
        }

        if quantity == 0 {
            return Err(ContractError::InvalidQuantity);
        }

        user.require_auth();

        let token_contract: Address = env
            .storage()
            .instance()
            .get(&DataKey::TokenContract)
            .ok_or(ContractError::NotInitialized)?;

        let unit_price: i128 = env
            .storage()
            .instance()
            .get(&DataKey::PricePerChapter)
            .ok_or(ContractError::NotInitialized)?;

        let total_price = unit_price
            .checked_mul(i128::from(quantity))
            .ok_or(ContractError::ArithmeticOverflow)?;

        let payment_contract = env.current_contract_address();

        let token_client = ChapterTokenClient::new(&env, &token_contract);

        token_client.transfer(&user, &payment_contract, &total_price);

        let unlocked_key = DataKey::UnlockedCount(user.clone());

        let current_unlocked: u32 = env.storage().persistent().get(&unlocked_key).unwrap_or(0);

        let new_unlocked = current_unlocked
            .checked_add(quantity)
            .ok_or(ContractError::ArithmeticOverflow)?;

        let current_payment_count: u64 = env
            .storage()
            .persistent()
            .get(&DataKey::PaymentCount)
            .unwrap_or(0);

        let payment_id = current_payment_count
            .checked_add(1)
            .ok_or(ContractError::ArithmeticOverflow)?;

        let current_total_chapters: u64 = env
            .storage()
            .persistent()
            .get(&DataKey::TotalChaptersUnlocked)
            .unwrap_or(0);

        let new_total_chapters = current_total_chapters
            .checked_add(u64::from(quantity))
            .ok_or(ContractError::ArithmeticOverflow)?;

        let current_revenue: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::TotalRevenue)
            .unwrap_or(0);

        let new_revenue = current_revenue
            .checked_add(total_price)
            .ok_or(ContractError::ArithmeticOverflow)?;

        let payment = PaymentRecord {
            payment_id,
            user: user.clone(),
            quantity,
            unit_price,
            total_price,
            ledger: env.ledger().sequence(),
            timestamp: env.ledger().timestamp(),
        };

        env.storage().persistent().set(&unlocked_key, &new_unlocked);

        env.storage()
            .persistent()
            .set(&DataKey::PaymentCount, &payment_id);

        env.storage()
            .persistent()
            .set(&DataKey::Payment(payment_id), &payment);

        env.storage()
            .persistent()
            .set(&DataKey::TotalChaptersUnlocked, &new_total_chapters);

        env.storage()
            .persistent()
            .set(&DataKey::TotalRevenue, &new_revenue);

        ChapterPurchasedEvent {
            payment_id,
            user,
            quantity,
            total_price,
            unlocked_count: new_unlocked,
        }
        .publish(&env);

        Ok(payment)
    }

    pub fn update_price(env: Env, admin: Address, new_price: i128) -> Result<(), ContractError> {
        require_admin(&env, &admin)?;

        if new_price <= 0 {
            return Err(ContractError::InvalidPrice);
        }

        let previous_price: i128 = env
            .storage()
            .instance()
            .get(&DataKey::PricePerChapter)
            .ok_or(ContractError::NotInitialized)?;

        env.storage()
            .instance()
            .set(&DataKey::PricePerChapter, &new_price);

        PriceUpdatedEvent {
            admin,
            previous_price,
            new_price,
        }
        .publish(&env);

        Ok(())
    }

    pub fn set_paused(env: Env, admin: Address, paused: bool) -> Result<(), ContractError> {
        require_admin(&env, &admin)?;

        env.storage().instance().set(&DataKey::Paused, &paused);

        PauseUpdatedEvent { admin, paused }.publish(&env);

        Ok(())
    }

    pub fn get_unlocked_count(env: Env, user: Address) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::UnlockedCount(user))
            .unwrap_or(0)
    }

    pub fn is_unlocked(env: Env, user: Address) -> bool {
        Self::get_unlocked_count(env, user) > 0
    }

    pub fn get_price_per_chapter(env: Env) -> Result<i128, ContractError> {
        env.storage()
            .instance()
            .get(&DataKey::PricePerChapter)
            .ok_or(ContractError::NotInitialized)
    }

    pub fn get_total_price(env: Env, quantity: u32) -> Result<i128, ContractError> {
        if quantity == 0 {
            return Err(ContractError::InvalidQuantity);
        }

        let price_per_chapter: i128 = env
            .storage()
            .instance()
            .get(&DataKey::PricePerChapter)
            .ok_or(ContractError::NotInitialized)?;

        price_per_chapter
            .checked_mul(i128::from(quantity))
            .ok_or(ContractError::ArithmeticOverflow)
    }

    pub fn get_token_contract(env: Env) -> Result<Address, ContractError> {
        env.storage()
            .instance()
            .get(&DataKey::TokenContract)
            .ok_or(ContractError::NotInitialized)
    }

    pub fn get_admin(env: Env) -> Result<Address, ContractError> {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(ContractError::NotInitialized)
    }

    pub fn is_paused(env: Env) -> bool {
        is_contract_paused(&env)
    }

    pub fn get_payment(env: Env, payment_id: u64) -> Result<PaymentRecord, ContractError> {
        env.storage()
            .persistent()
            .get(&DataKey::Payment(payment_id))
            .ok_or(ContractError::PaymentNotFound)
    }

    pub fn get_stats(env: Env) -> PaymentStats {
        PaymentStats {
            payment_count: env
                .storage()
                .persistent()
                .get(&DataKey::PaymentCount)
                .unwrap_or(0),

            total_chapters_unlocked: env
                .storage()
                .persistent()
                .get(&DataKey::TotalChaptersUnlocked)
                .unwrap_or(0),

            total_revenue: env
                .storage()
                .persistent()
                .get(&DataKey::TotalRevenue)
                .unwrap_or(0),
        }
    }
}

fn ensure_initialized(env: &Env) -> Result<(), ContractError> {
    if env.storage().instance().has(&DataKey::Admin) {
        Ok(())
    } else {
        Err(ContractError::NotInitialized)
    }
}

fn require_admin(env: &Env, admin: &Address) -> Result<(), ContractError> {
    let stored_admin: Address = env
        .storage()
        .instance()
        .get(&DataKey::Admin)
        .ok_or(ContractError::NotInitialized)?;

    if stored_admin != *admin {
        return Err(ContractError::Unauthorized);
    }

    admin.require_auth();

    Ok(())
}

fn is_contract_paused(env: &Env) -> bool {
    env.storage()
        .instance()
        .get(&DataKey::Paused)
        .unwrap_or(false)
}
