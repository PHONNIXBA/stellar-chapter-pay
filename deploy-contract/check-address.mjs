import * as StellarSDK from "@stellar/stellar-sdk";

const secret = process.env.BOB_SECRET;
const kp = StellarSDK.Keypair.fromSecret(secret);

console.log("Derived public key:", kp.publicKey());