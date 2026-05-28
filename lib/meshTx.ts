// LEARNING: lib/meshTx.ts contains the two core transaction builders.
//
// Cardano has two kinds of transactions we care about here:
//
//   LOCK   — Admin sends ADA to the script address with a datum (the secret
//             number). The funds are now "guarded" by the validator.
//
//   REDEEM — User provides a redeemer (their guess). The validator runs on-chain
//             and either succeeds (guess == datum → funds released) or fails.
//
// We use @meshsdk/core's MeshTxBuilder to construct the transaction body,
// then hand the unsigned hex to the CIP-30 wallet bridge for signing.
// Submission goes through BlockfrostProvider.submitTx() rather than the
// wallet's own CIP-30 submitTx — wallets like Eternl route CIP-30 submissions
// through their internal node and can return opaque "unknown error" messages
// on any rejection; Blockfrost gives a concrete error string instead.
//
// RAW CIP-30 WALLET BRIDGE PATTERN (what happens under the hood):
//
//   // 1. Connect — triggers the wallet's permission dialog
//   const cip30 = await window.cardano["eternl"].enable()
//
//   // 2. Read wallet data (returns raw CBOR hex strings from the wallet)
//   const utxosCbor  = await cip30.getUtxos()        // encoded UTxOs
//   const changeAddr = await cip30.getChangeAddress() // bech32 address
//
//   // 3. Sign — wallet shows the user a confirmation dialog
//   const signedTx = await cip30.signTx(unsignedTxHex, true)
//
//   // 4. Submit — we call Blockfrost directly, not the wallet's submitTx
//   const txHash = await blockfrostProvider.submitTx(signedTx)

import {
  BlockfrostProvider,
  MeshTxBuilder,
  applyCborEncoding,
  type UTxO,
} from "@meshsdk/core"
import { SCRIPT_CBOR, SCRIPT_ADDRESS, NETWORK } from "./contract"
import { patchScriptIntegrityHash } from "./fixScriptIntegrityHash"

// LEARNING: We define a minimal interface rather than coupling to a specific
// wallet class. Both BrowserWallet (@meshsdk/core) and MeshCardanoBrowserWallet
// (@meshsdk/react's useWallet) satisfy this interface via structural typing.
// The "Mesh" suffix variants return fully-typed UTxO objects rather than raw CBOR.
export interface WalletInterface {
  getUtxosMesh(): Promise<UTxO[]>
  getCollateralMesh(): Promise<UTxO[]>
  getChangeAddressBech32(): Promise<string>
  // signTxReturnFullTx merges the wallet's witness set into the tx body and
  // returns the complete signed CBOR — what BlockfrostProvider.submitTx() expects.
  // (Raw CIP-30 signTx returns witness-only CBOR, which Blockfrost will reject.)
  signTxReturnFullTx(tx: string, partialSign: boolean): Promise<string>
}

// LEARNING: applyCborEncoding() double-CBOR-encodes the raw compiled script from
// plutus.json. Cardano transactions require the script to be wrapped in an
// extra CBOR layer before inclusion in the witness set.
const ENCODED_SCRIPT = applyCborEncoding(SCRIPT_CBOR)

function makeProvider(): BlockfrostProvider {
  // BlockfrostProvider detects the testnet from the "preview" key prefix.
  // It handles protocol parameter fetching, redeemer evaluation, and submission.
  return new BlockfrostProvider(
    process.env.NEXT_PUBLIC_BLOCKFROST_KEY ?? ""
  )
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type LockParams = {
  lovelace: number   // 1 ADA = 1_000_000 lovelace
  secretCode: number // becomes the datum — the "secret number" in the machine
}

export type RedeemParams = {
  scriptUtxo: UTxO // the UTxO locked at the script address
  guess: number    // user's guess — sent as the redeemer
}

// Convert a Blockfrost UTxO to the Mesh UTxO format expected by MeshTxBuilder
export function bfToMeshUtxo(
  txHash: string,
  txIndex: number,
  amount: { unit: string; quantity: string }[],
  address: string,
  plutusData?: string | null
): UTxO {
  return {
    input: { txHash, outputIndex: txIndex },
    output: {
      address,
      amount,
      // plutusData is the inline datum as CBOR hex — the validator reads this
      plutusData: plutusData ?? undefined,
    },
  }
}

// ─── Lock transaction ─────────────────────────────────────────────────────────

// LEARNING: Locking means creating a UTxO AT the script address with:
//   • the ADA as the "value" (assets stored in the UTxO)
//   • the datum (secret code) attached inline so the validator can read it
//
// No signature from the script is needed to lock — anyone can send funds
// to a script address. Only unlocking (redeeming) requires the validator to pass.

export async function buildLockTx(
  wallet: WalletInterface,
  params: LockParams
): Promise<string> {
  const provider = makeProvider()

  // Fetch wallet data via the underlying CIP-30 bridge
  const [walletUtxos, changeAddress] = await Promise.all([
    wallet.getUtxosMesh(),           // returns typed Mesh UTxOs (parsed from CIP-30 CBOR)
    wallet.getChangeAddressBech32(), // bech32 address string
  ])

  if (!walletUtxos || walletUtxos.length === 0) {
    throw new Error("No UTxOs in wallet. Fund it at the Preview faucet first.")
  }

  // LEARNING: Lock tx has NO scripts/redeemers — omit evaluator entirely.
  // Including an evaluator when there is nothing to evaluate would cause
  // MeshTxBuilder to include a script_data_hash field in the tx body,
  // which Ogmios/Blockfrost then tries to evaluate and rejects as an
  // "unsupported era" transaction.
  const txBuilder = new MeshTxBuilder({
    fetcher: provider, // fetches protocol params so fee calculation is accurate
    verbose: true,     // logs the tx body to the console for learning
  })

  txBuilder
    // LEARNING: txOut defines an output — who receives funds and how much.
    // We are sending lovelace to the script address (not a user address).
    .txOut(SCRIPT_ADDRESS, [{ unit: "lovelace", quantity: String(params.lovelace) }])
    // LEARNING: inline datum means the datum is stored directly in the UTxO output
    // on-chain. Without inline, the datum must be supplied separately on spend and
    // can be lost. The JSON format { int: N } encodes a plain Plutus integer.
    .txOutInlineDatumValue({ int: params.secretCode }, "JSON")
    // LEARNING: changeAddress is where leftover ADA goes after fees are deducted
    .changeAddress(changeAddress)
    // LEARNING: selectUtxosFrom gives the coin selector the inputs it can pick from
    .selectUtxosFrom(walletUtxos)
    .setNetwork(NETWORK)

  // complete() calculates fees, runs coin selection, and serialises the tx to CBOR hex
  const unsignedTx = await txBuilder.complete()

  // LEARNING: signTxReturnFullTx merges the wallet's witness into the tx body and
  // returns the complete signed CBOR. Raw CIP-30 signTx returns witness-only CBOR;
  // BlockfrostProvider.submitTx() requires the full transaction, not just the witness.
  const signedTx = await wallet.signTxReturnFullTx(unsignedTx, false)

  // LEARNING: We submit through BlockfrostProvider rather than wallet.submitTx().
  // wallet.submitTx() routes through the wallet extension's own internal node;
  // if that node rejects the tx it returns a generic "unknown error" with no detail.
  // Blockfrost returns a structured error message that tells us exactly what failed.
  const txHash = await provider.submitTx(signedTx)
  return txHash
}

// ─── Redeem transaction ───────────────────────────────────────────────────────

// LEARNING: Redeeming means spending a script UTxO. The transaction must:
//   1. Include the script UTxO as an input
//   2. Attach the validator script (so nodes can run it)
//   3. Provide the datum (already inline in our case)
//   4. Provide the redeemer (the user's guess)
//   5. Include collateral — a pure-ADA UTxO that gets slashed if the script fails
//      on-chain (phase-2 validation failure). Prevents spam attacks on validators.

export async function buildRedeemTx(
  wallet: WalletInterface,
  params: RedeemParams
): Promise<string> {
  const provider = makeProvider()

  const [collateralUtxos, changeAddress] = await Promise.all([
    wallet.getCollateralMesh(),      // pure-ADA UTxOs reserved for collateral
    wallet.getChangeAddressBech32(),
  ])

  if (!collateralUtxos || collateralUtxos.length === 0) {
    throw new Error(
      "No collateral UTxO set in wallet. Enable collateral in your wallet settings."
    )
  }

  const col = collateralUtxos[0]
  const { txHash, outputIndex } = params.scriptUtxo.input
  const { amount, address } = params.scriptUtxo.output

  const txBuilder = new MeshTxBuilder({
    fetcher: provider,
    evaluator: provider, // evaluates how much CPU/memory the script consumes
    verbose: true,
  })

  // LEARNING: The fee comes entirely from the locked ADA — we add no wallet inputs.
  // By omitting .txOut() and .selectUtxosFrom(), MeshTxBuilder treats the script
  // UTxO as the only input. complete() computes: change = locked_value - fee,
  // and routes that change to the redeemer's address. The redeemer gets everything
  // minus the protocol fee (~0.2-0.5 ADA for a script tx).
  txBuilder
    .spendingPlutusScriptV3()
    .txIn(txHash, outputIndex, amount, address)
    .txInScript(ENCODED_SCRIPT)
    .txInInlineDatumPresent()
    .txInRedeemerValue({ int: params.guess }, "JSON")
    .txInCollateral(
      col.input.txHash,
      col.input.outputIndex,
      col.output.amount,
      col.output.address
    )
    .changeAddress(changeAddress)
    .setNetwork(NETWORK)

  const unsignedTxRaw = await txBuilder.complete()
  // Patch the script_data_hash: MeshTxBuilder computes it with a stale hardcoded
  // V3 cost model (296 entries) but Preview now has 350. We fetch the real cost
  // models from Blockfrost and recompute the hash before handing the tx to the wallet.
  const unsignedTx = await patchScriptIntegrityHash(unsignedTxRaw)
  const signedTx = await wallet.signTxReturnFullTx(unsignedTx, true)

  // Submit through Blockfrost for structured error messages
  const txHash2 = await provider.submitTx(signedTx)
  return txHash2
}
