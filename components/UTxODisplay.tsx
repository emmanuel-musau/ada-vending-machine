// LEARNING: UTxODisplay shows what is currently locked in the vending machine.
//
// In Cardano, a UTxO (Unspent Transaction Output) is the fundamental unit of
// value. Think of it as a "coin" that can hold any combination of ADA and
// native tokens. The vending machine is just a script address — a special
// address whose spending is controlled by the validator code rather than a
// private key. Any UTxO sitting at that address is "locked" until someone
// provides the correct datum (secret code) as the redeemer.
//
// This component polls Blockfrost every 15 s to show what's currently locked.

"use client"

import { useEffect, useState } from "react"
import { fetchScriptUtxos, type BfUtxo } from "@/lib/blockfrost"
import { SCRIPT_ADDRESS, CARDANOSCAN_BASE } from "@/lib/contract"

interface UTxODisplayProps {
  refreshTrigger?: number // increment this to force a refresh
}

function formatLovelace(amount: { unit: string; quantity: string }[]): string {
  const lv = amount.find((a) => a.unit === "lovelace")
  if (!lv) return "0 ADA"
  const ada = (parseInt(lv.quantity) / 1_000_000).toFixed(2)
  return `${ada} ADA (${Number(lv.quantity).toLocaleString()} lovelace)`
}

function formatTokens(amount: { unit: string; quantity: string }[]): string[] {
  return amount
    .filter((a) => a.unit !== "lovelace")
    .map((a) => {
      // unit = policyId (56 chars) + assetName (hex). Split for display.
      const policyId = a.unit.slice(0, 56)
      const assetHex = a.unit.slice(56)
      // Try to decode asset name as UTF-8 for human-readable names
      let assetName = assetHex
      try {
        assetName = Buffer.from(assetHex, "hex").toString("utf8")
      } catch {}
      return `${a.quantity} × ${assetName} [${policyId.slice(0, 8)}…]`
    })
}

// Decode the inline datum (a CBOR-encoded integer) to a readable string
// LEARNING: The datum is stored as CBOR hex. A CBOR-encoded small integer looks
// like "182a" for 42 (0x18 = unsigned int, next byte, 0x2a = 42).
// We display it raw so developers can see exactly what the validator reads.
function decodeDatum(datum: string | null): string {
  if (!datum) return "(no datum)"
  // Try naive decode: CBOR integer 0x18 XX = XX, 0x19 XXYY = XXYY, or 0x00-0x17 directly
  try {
    const buf = Buffer.from(datum, "hex")
    const first = buf[0]
    if (first <= 0x17) return String(first) // 0-23 encoded directly
    if (first === 0x18) return String(buf[1]) // 1-byte uint
    if (first === 0x19) return String(buf.readUInt16BE(1)) // 2-byte uint
    if (first === 0x1a) return String(buf.readUInt32BE(1)) // 4-byte uint
    // Negative integers: 0x20-0x37 = -1 to -24, 0x38 = next byte
    if (first >= 0x20 && first <= 0x37) return String(0x20 - first - 1)
    if (first === 0x38) return String(-buf[1] - 1)
  } catch {}
  return `0x${datum}` // fall back to raw hex
}

export default function UTxODisplay({ refreshTrigger = 0 }: UTxODisplayProps) {
  const [utxos, setUtxos] = useState<BfUtxo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    fetchScriptUtxos(SCRIPT_ADDRESS)
      .then((data) => {
        if (active) {
          setUtxos(data)
          setLoading(false)
        }
      })
      .catch((e) => {
        if (active) {
          setError(e.message ?? "Failed to fetch UTxOs")
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [refreshTrigger])

  return (
    <div className="border border-[#0D2040] p-4 rounded-xl font-mono text-sm bg-[#050D1F]">
      <div className="text-blue-800 mb-3 text-xs">
        SCRIPT ADDRESS: {SCRIPT_ADDRESS}
      </div>

      {/* Only show spinner on the very first load — subsequent refreshes keep existing data visible */}
      {loading && utxos.length === 0 && (
        <div className="text-blue-500 animate-pulse">
          fetching UTxOs from Blockfrost…
        </div>
      )}

      {error && <div className="text-red-500">ERROR: {error}</div>}

      {!loading && !error && utxos.length === 0 && (
        <div className="text-blue-900">
          {"> "} no UTxOs at script address — machine is empty
        </div>
      )}

      {utxos.map((utxo) => (
          <div
            key={`${utxo.tx_hash}-${utxo.tx_index}`}
            className="mb-4 border-l-2 border-[#0033AD] pl-3"
          >
            {/* LEARNING: Each UTxO is identified by (txHash, outputIndex).
                This is the "name" of the coin — unique across the entire blockchain. */}
            <div className="text-blue-300">
              UTxO: {utxo.tx_hash.slice(0, 16)}…#{utxo.tx_index}
            </div>

            {/* LEARNING: The "value" of a UTxO is the set of assets it holds. */}
            <div className="text-blue-200 mt-1">
              ├─ ADA:  {formatLovelace(utxo.amount)}
            </div>

            {formatTokens(utxo.amount).map((t, i) => (
              <div key={i} className="text-yellow-400">
                ├─ TKN: {t}
              </div>
            ))}

            {/* LEARNING: The datum is the "lock" — the validator checks the redeemer
                against this value. "Inline" means it lives in the UTxO output itself,
                making it readable without a separate lookup. */}
            <div className="text-blue-400 mt-1">
              └─ DATUM (raw CBOR hex): {utxo.inline_datum ?? "(none)"}
              <span className="text-blue-700 ml-2">
                → decoded: {decodeDatum(utxo.inline_datum)}
              </span>
            </div>

            <a
              href={`${CARDANOSCAN_BASE}/transaction/${utxo.tx_hash}`}
              target="_blank"
              rel="noreferrer"
              className="text-[#0033AD] hover:text-blue-400 text-xs mt-1 inline-block transition-colors"
            >
              [view on Cardanoscan ↗]
            </a>
          </div>
        ))}
    </div>
  )
}
