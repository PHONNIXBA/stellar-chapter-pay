#![cfg(test)]

use super::*;

use soroban_sdk::{contract, contractimpl, contracttype, testutils::Address as _, Address, Env};

#[contracttype]
#[derive(Clone)]
enum TestTokenKey {
    Balance(Address),
}

#[contract]
struct TestTokenContract;

#[contractimpl]
impl TestTokenContract {
    pub fn mint(env: Env, to: Address, amount: i128) {
        let key = TestTokenKey::Balance(to);

        let balance: i128 = env.storage().persistent().get(&key).unwrap_or(0);

        env.storage().persistent().set(&key, &(balance + amount));
    }

    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();

        let from_key = TestTokenKey::Balance(from);
        let to_key = TestTokenKey::Balance(to);

        let from_balance: i128 = env.storage().persistent().get(&from_key).unwrap_or(0);

        if from_balance < amount {
            panic!("insufficient token balance");
        }

        let to_balance: i128 = env.storage().persistent().get(&to_key).unwrap_or(0);

        env.storage()
            .persistent()
            .set(&from_key, &(from_balance - amount));

        env.storage()
            .persistent()
            .set(&to_key, &(to_balance + amount));
    }

    pub fn balance(env: Env, user: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&TestTokenKey::Balance(user))
            .unwrap_or(0)
    }
}

#[test]
fn initializes_configuration_and_empty_stats() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let token_id = env.register(TestTokenContract, ());
    let payment_id = env.register(ChapterPaymentContract, ());

    let client = ChapterPaymentContractClient::new(&env, &payment_id);

    client.initialize(&admin, &token_id, &5);

    assert_eq!(client.get_admin(), admin);
    assert_eq!(client.get_token_contract(), token_id);
    assert_eq!(client.get_price_per_chapter(), 5);
    assert!(!client.is_paused());

    let stats = client.get_stats();

    assert_eq!(stats.payment_count, 0);
    assert_eq!(stats.total_chapters_unlocked, 0);
    assert_eq!(stats.total_revenue, 0);
}

#[test]
fn unlock_transfers_tokens_and_records_payment() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    let token_id = env.register(TestTokenContract, ());
    let payment_id = env.register(ChapterPaymentContract, ());

    let token_client = TestTokenContractClient::new(&env, &token_id);

    let payment_client = ChapterPaymentContractClient::new(&env, &payment_id);

    token_client.mint(&user, &100);

    payment_client.initialize(&admin, &token_id, &5);

    let payment = payment_client.unlock_with_payment(&user, &3);

    assert_eq!(payment.payment_id, 1);
    assert_eq!(payment.user, user);
    assert_eq!(payment.quantity, 3);
    assert_eq!(payment.unit_price, 5);
    assert_eq!(payment.total_price, 15);

    assert_eq!(payment_client.get_unlocked_count(&user), 3,);

    assert!(payment_client.is_unlocked(&user));

    assert_eq!(token_client.balance(&user), 85,);

    assert_eq!(token_client.balance(&payment_id), 15,);

    assert_eq!(payment_client.get_payment(&1), payment,);
}

#[test]
fn repeated_payments_update_aggregate_stats() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    let token_id = env.register(TestTokenContract, ());
    let payment_id = env.register(ChapterPaymentContract, ());

    let token_client = TestTokenContractClient::new(&env, &token_id);

    let payment_client = ChapterPaymentContractClient::new(&env, &payment_id);

    token_client.mint(&user, &100);

    payment_client.initialize(&admin, &token_id, &5);

    payment_client.unlock_with_payment(&user, &2);

    payment_client.unlock_with_payment(&user, &4);

    let stats = payment_client.get_stats();

    assert_eq!(payment_client.get_unlocked_count(&user), 6,);

    assert_eq!(stats.payment_count, 2);
    assert_eq!(stats.total_chapters_unlocked, 6);
    assert_eq!(stats.total_revenue, 30);

    assert_eq!(token_client.balance(&user), 70,);

    assert_eq!(token_client.balance(&payment_id), 30,);
}

#[test]
fn admin_can_update_price() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let token_id = env.register(TestTokenContract, ());
    let payment_id = env.register(ChapterPaymentContract, ());

    let client = ChapterPaymentContractClient::new(&env, &payment_id);

    client.initialize(&admin, &token_id, &5);

    client.update_price(&admin, &8);

    assert_eq!(client.get_price_per_chapter(), 8,);

    assert_eq!(client.get_total_price(&3), 24,);
}

#[test]
fn admin_can_pause_and_resume_payments() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let token_id = env.register(TestTokenContract, ());
    let payment_id = env.register(ChapterPaymentContract, ());

    let client = ChapterPaymentContractClient::new(&env, &payment_id);

    client.initialize(&admin, &token_id, &5);

    client.set_paused(&admin, &true);

    assert!(client.is_paused());

    client.set_paused(&admin, &false);

    assert!(!client.is_paused());
}

#[test]
#[should_panic]
fn zero_quantity_is_rejected() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let token_id = env.register(TestTokenContract, ());
    let payment_id = env.register(ChapterPaymentContract, ());

    let client = ChapterPaymentContractClient::new(&env, &payment_id);

    client.initialize(&admin, &token_id, &5);

    client.get_total_price(&0);
}

#[test]
#[should_panic]
fn paused_contract_rejects_payment() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    let token_id = env.register(TestTokenContract, ());
    let payment_id = env.register(ChapterPaymentContract, ());

    let token_client = TestTokenContractClient::new(&env, &token_id);

    let payment_client = ChapterPaymentContractClient::new(&env, &payment_id);

    token_client.mint(&user, &100);

    payment_client.initialize(&admin, &token_id, &5);

    payment_client.set_paused(&admin, &true);

    payment_client.unlock_with_payment(&user, &1);
}
