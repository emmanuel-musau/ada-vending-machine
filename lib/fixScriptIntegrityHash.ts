// MeshTxBuilder computes script_data_hash using DEFAULT_V3_COST_MODEL_LIST — a
// hardcoded list that has 296 entries. The Preview testnet now has 350 entries.
// They diverged after a protocol parameter update, so every Plutus V3 transaction
// MeshTxBuilder builds gets a wrong script_data_hash → node rejects with
// ScriptIntegrityHashMismatch.
//
// This module fetches the real V3 cost models from Blockfrost and re-computes
// the hash, then patches it into the unsigned transaction body before signing.

import {
  Serialization,
  blake2b,
  TxCBOR,
} from "@meshsdk/core-cst"

async function fetchV3CostModelValues(): Promise<number[]> {
  const key = process.env.NEXT_PUBLIC_BLOCKFROST_KEY ?? ""
  const network = key.startsWith("mainnet") ? "mainnet" : key.startsWith("preview") ? "preview" : "preprod"
  const base = `https://cardano-${network}.blockfrost.io/api/v0`

  const res = await fetch(`${base}/epochs/latest/parameters`, {
    headers: { project_id: key },
  })
  if (!res.ok) throw new Error(`Blockfrost protocol params fetch failed: ${res.status}`)

  const data = await res.json()
  const v3: Record<string, number> = data?.cost_models?.PlutusV3 ?? {}
  const values = Object.values(v3)
  if (values.length === 0) throw new Error("PlutusV3 cost model not found in protocol parameters")
  return values
}

function recomputeScriptIntegrityHash(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  redeemers: any,
  costModelValues: number[]
): string {
  // Build a Costmdls containing only PlutusV3 (the only language used in this tx)
  const v3Model = Serialization.CostModel.newPlutusV3(costModelValues)
  const costmdls = new Serialization.Costmdls()
  costmdls.insert(v3Model)

  // Reproduce the hashScriptData logic from @meshsdk/core-cst internals:
  // hash = blake2b-256( CBOR(redeemers) || CBOR(cost_models.languageViewsEncoding()) )
  const writer = new Serialization.CborWriter()
  writer.writeEncodedValue(Buffer.from(redeemers.toCbor(), "hex"))
  writer.writeEncodedValue(Buffer.from(costmdls.languageViewsEncoding(), "hex"))

  const hashHex = blake2b.hash(
    Buffer.from(writer.encode()).toString("hex"),
    32
  )
  return hashHex
}

export async function patchScriptIntegrityHash(unsignedTxCbor: string): Promise<string> {
  const costModelValues = await fetchV3CostModelValues()

  const tx = Serialization.Transaction.fromCbor(TxCBOR(unsignedTxCbor))
  const witnessSet = tx.witnessSet()

  const redeemers = witnessSet.redeemers()
  if (!redeemers || redeemers.size() === 0) {
    // No script inputs — nothing to patch
    return unsignedTxCbor
  }

  const correctHashHex = recomputeScriptIntegrityHash(redeemers, costModelValues)

  const body = tx.body()
  // Hash32ByteBase16 is a branded string — setScriptDataHash accepts the raw 64-char hex
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body.setScriptDataHash(correctHashHex as any)

  const patched = new Serialization.Transaction(body, witnessSet, tx.auxiliaryData())
  return patched.toCbor()
}
