# Stellar Chapter Journey

This repository documents my progress through **Level 1** and **Level 2** of the Stellar learning path.

The project started as a simple payment demo on Stellar Testnet, then evolved into a smart contract based chapter unlock dApp.

---

## Project Overview

This project is based on a bigger product idea:

> a reading platform on Stellar where users unlock chapters and, in future versions, authors can receive transparent revenue sharing through smart contracts.

To match the learning path requirements, the project was developed in stages:

- **Level 1:** wallet connection, balance display, and testnet payment flow
- **Level 2:** smart contract deployment, contract interaction from the frontend, chapter unlock logic, and error handling

---

# Level 1 – Stellar Chapter Pay

## Goal

Build a beginner-friendly Stellar dApp on **Stellar Testnet** that demonstrates the basic payment flow.

## Level 1 Features

- Connect Freighter wallet
- Disconnect wallet
- Display connected wallet address
- Fetch and display XLM balance
- Send XLM payment on Testnet
- Show transaction success or failure
- Show transaction hash after payment

## Level 1 Tech Stack

- React
- Vite
- Freighter API
- Stellar SDK

## Level 1 Screenshot

![Level 1 Demo](./screenshot/level1-wallet-and-payment.png)

---

# Level 2 – Stellar Chapter Unlock

## Goal

Extend the project into a smart contract powered dApp where users can unlock a chapter through a deployed contract on Stellar Testnet.

## Level 2 Features

- Connect wallet from the frontend
- Read chapter unlock state from the contract
- Call the `unlock` contract function from the frontend
- Show transaction status
- Show transaction hash
- Handle user and wallet errors clearly in the UI

## Smart Contract

### Current Contract Address
`CA4OE7GBLEUISESUKWDOLTX4B25CNFWZMGT4LIMFOWOYW5L3MD7WV6RI`

### Main Functions

- `is_unlocked(user)` → checks whether a chapter is unlocked
- `unlock(user)` → unlocks the chapter for the connected wallet

## Level 2 Deployment Evidence

### WASM Upload Transaction Hash
`a3bf12a88de8537bec5a95377b98757a70c5e48178f1fded5a427ba434d50fc1`

### Contract Deploy Transaction Hash
`126ff0614d759cbd63c89c2c704304585bebada854348063218fb47b660963ee`

## Level 2 Error Handling

The frontend handles these error cases:

- Wallet not connected
- Wrong network
- Already unlocked
- Signature rejected
- Contract call failed

## Level 2 Suggested Screenshots

If these files exist in your `screenshot` folder, they will show directly on GitHub.

### Frontend Success
![Frontend Success](./screenshot/level2-frontend-success.png)

### Contract Deploy Success
![Contract Deploy Success](./screenshot/level2-contract-deploy-success.png)

### Read Contract Status
![Read Contract Status](./screenshot/level2-read-contract-true.png)

### Error - Wallet Not Connected
![Wallet Not Connected](./screenshot/level2-error-wallet-not-connected.png)

### Error - Wrong Network
![Wrong Network](./screenshot/level2-error-wrong-network.png)

### Error - Already Unlocked
![Already Unlocked](./screenshot/level2-error-already-unlocked.png)

---

# How to Run Locally

## 1. Clone the repository

```bash
git clone https://github.com/PHONNIXBA/stellar-chapter-pay.git
cd stellar-chapter-pay