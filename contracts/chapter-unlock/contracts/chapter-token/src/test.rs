#![cfg(test)]

use super::*;

use soroban_sdk::{testutils::Address as _, Address, Env, String};

#[test]
fn initializes_token_metadata() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let contract_id = env.register(ChapterTokenContract, ());

    let client = ChapterTokenContractClient::new(&env, &contract_id);

    let name = String::from_str(&env, "Chapter Coin");

    let symbol = String::from_str(&env, "COIN");

    client.initialize(&admin, &name, &symbol, &0);

    assert_eq!(client.admin(), admin,);

    assert_eq!(client.name(), name,);

    assert_eq!(client.symbol(), symbol,);

    assert_eq!(client.decimals(), 0,);

    assert_eq!(client.total_supply(), 0,);
}

#[test]
fn faucet_adds_demo_tokens() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    let contract_id = env.register(ChapterTokenContract, ());

    let client = ChapterTokenContractClient::new(&env, &contract_id);

    client.initialize(
        &admin,
        &String::from_str(&env, "Chapter Coin"),
        &String::from_str(&env, "COIN"),
        &0,
    );

    client.faucet(&user);

    assert_eq!(client.balance(&user), 100,);

    assert!(client.has_claimed(&user),);

    assert_eq!(client.total_supply(), 100,);
}

#[test]
fn transfer_updates_account_balances() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let recipient = Address::generate(&env);

    let contract_id = env.register(ChapterTokenContract, ());

    let client = ChapterTokenContractClient::new(&env, &contract_id);

    client.initialize(
        &admin,
        &String::from_str(&env, "Chapter Coin"),
        &String::from_str(&env, "COIN"),
        &0,
    );

    client.faucet(&user);

    client.transfer(&user, &recipient, &40);

    assert_eq!(client.balance(&user), 60,);

    assert_eq!(client.balance(&recipient), 40,);

    assert_eq!(client.total_supply(), 100,);
}

#[test]
fn admin_can_mint_tokens() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    let contract_id = env.register(ChapterTokenContract, ());

    let client = ChapterTokenContractClient::new(&env, &contract_id);

    client.initialize(
        &admin,
        &String::from_str(&env, "Chapter Coin"),
        &String::from_str(&env, "COIN"),
        &0,
    );

    client.mint(&user, &250);

    assert_eq!(client.balance(&user), 250,);

    assert_eq!(client.total_supply(), 250,);

    let stats = client.get_stats();

    assert_eq!(stats.total_supply, 250,);

    assert_eq!(stats.faucet_amount, 100,);
}

#[test]
#[should_panic]
fn faucet_cannot_be_claimed_twice() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    let contract_id = env.register(ChapterTokenContract, ());

    let client = ChapterTokenContractClient::new(&env, &contract_id);

    client.initialize(
        &admin,
        &String::from_str(&env, "Chapter Coin"),
        &String::from_str(&env, "COIN"),
        &0,
    );

    client.faucet(&user);
    client.faucet(&user);
}

#[test]
#[should_panic]
fn transfer_rejects_insufficient_balance() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let recipient = Address::generate(&env);

    let contract_id = env.register(ChapterTokenContract, ());

    let client = ChapterTokenContractClient::new(&env, &contract_id);

    client.initialize(
        &admin,
        &String::from_str(&env, "Chapter Coin"),
        &String::from_str(&env, "COIN"),
        &0,
    );

    client.transfer(&user, &recipient, &10);
}

#[test]
#[should_panic]
fn mint_rejects_zero_amount() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    let contract_id = env.register(ChapterTokenContract, ());

    let client = ChapterTokenContractClient::new(&env, &contract_id);

    client.initialize(
        &admin,
        &String::from_str(&env, "Chapter Coin"),
        &String::from_str(&env, "COIN"),
        &0,
    );

    client.mint(&user, &0);
}
