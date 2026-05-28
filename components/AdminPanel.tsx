// LEARNING: AdminPanel demonstrates the "lock" half of the vending machine.
//
// Any Cardano transaction can send ADA to a script address — no permission
// is required from the script. What the admin is doing here is:
//   1. Choosing a secret number (the datum)
//   2. Specifying how much ADA to lock
//   3. Submitting a transaction that creates a UTxO at the script address
//
// The datum is stored "inline" — embedded directly in the UTxO output on-chain.
// The Plutus validator will read it and compare it to whatever redeemer the
// user provides when trying to unlock the funds.

"use client"

import { useState } from "react"
import { useWallet } from "@meshsdk/react"
import WalletConnector from "./WalletConnector"
import UTxODisplay from "./UTxODisplay"
import { buildLockTx } from "@/lib/meshTx"
import { CARDANOSCAN_BASE } from "@/lib/contract"
import { parseCardanoError } from "@/lib/errors"

type Status = { type: "idle" | "pending" | "success" | "error"; message?: string; txHash?: string }

export default function AdminPanel() {
  // LEARNING: useWallet() returns the currently connected MeshCardanoBrowserWallet.
  // It wraps the raw CIP-30 API and exposes typed "Mesh" methods for UTxOs.
  const { connected, wallet } = useWallet()
  // Cast to our minimal WalletInterface — MeshCardanoBrowserWallet satisfies it
  // via structural typing (getUtxosMesh, getCollateralMesh, getChangeAddressBech32).
  const typedWallet = wallet as unknown as import("@/lib/meshTx").WalletInterface

  // LEARNING: Cardano enforces a minimum UTxO value calculated from the output's
  // byte size × utxoCostPerByte protocol parameter. For a script output with a
  // small inline datum (~5 bytes), the minimum is ~1.1 ADA. We use 2 ADA as a
  // safe floor that covers any inline datum size we might use here.
  const MIN_ADA = 2

  // ADA amount entered by the user — converted to lovelace before the tx is built
  const [ada, setAda] = useState("5")
  const [secretCode, setSecretCode] = useState("")
  const [refreshCounter, setRefreshCounter] = useState(0)
  const [status, setStatus] = useState<Status>({ type: "idle" })

  const adaNum = Number(ada)
  // LEARNING: Cardano amounts are always integers (lovelace). Never use floats on-chain.
  const lovelace = Math.round(adaNum * 1_000_000)

  async function handleLock() {
    if (!connected || !wallet) return
    if (!secretCode || isNaN(Number(secretCode))) {
      setStatus({ type: "error", message: "Enter a valid secret code (any integer)." })
      return
    }
    if (!ada || isNaN(adaNum) || adaNum < MIN_ADA) {
      setStatus({
        type: "error",
        message: `Minimum ${MIN_ADA} ADA required — Cardano script outputs have a minimum UTxO deposit.`,
      })
      return
    }

    setStatus({ type: "pending", message: "Building lock transaction…" })

    try {
      const txHash = await buildLockTx(typedWallet, {
        lovelace,
        secretCode: Number(secretCode),
      })
      setStatus({ type: "success", txHash })
      setRefreshCounter((n) => n + 1)
    } catch (e: unknown) {
      setStatus({ type: "error", message: parseCardanoError(e) })
    }
  }

  const inputCls =
    "w-full bg-[#050D1F] border border-[#162850] text-blue-100 px-3 py-2.5 text-sm focus:outline-none focus:border-[#0033AD] placeholder-blue-900 rounded-lg transition-colors"

  const labelCls = "block text-blue-500 text-xs mb-1.5 uppercase tracking-wider"

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* ── Wallet ─────────────────────────────────────────────────── */}
      <section className="border border-[#162850] p-6 rounded-2xl bg-[#0A1730]">
        <div className="text-[#0033AD] text-xs mb-4 uppercase tracking-wider font-bold">
          [ WALLET ]
        </div>
        <WalletConnector label="Connect Admin Wallet" />
        {connected && (
          <div className="text-green-600 text-xs mt-3">
            ✓ wallet connected — ready to lock funds
          </div>
        )}
      </section>

      {/* ── Lock form ──────────────────────────────────────────────── */}
      <section className="border border-[#162850] p-6 rounded-2xl bg-[#0A1730] space-y-5">
        <div className="text-[#0033AD] text-xs uppercase tracking-wider font-bold">
          [ LOCK ADA INTO MACHINE ]
        </div>

        {/* ADA amount */}
        <div>
          <label className={labelCls}>ADA to lock</label>
          <input
            className={`${inputCls} ${
              ada && adaNum < MIN_ADA ? "border-red-700 focus:border-red-500" : ""
            }`}
            type="number"
            min={MIN_ADA}
            step="0.5"
            value={ada}
            onChange={(e) => setAda(e.target.value)}
            placeholder="5"
          />
          {/* LEARNING: 1 ADA = 1,000,000 lovelace. The tx builder receives lovelace
              because Cardano amounts are always integers on-chain. */}
          <div className="mt-1.5 flex gap-4 text-xs">
            {ada && !isNaN(adaNum) && (
              <span className={adaNum < MIN_ADA ? "text-red-500" : "text-blue-400"}>
                = {lovelace.toLocaleString()} lovelace
                {adaNum < MIN_ADA && (
                  <span className="ml-2">✗ minimum {MIN_ADA} ADA</span>
                )}
              </span>
            )}
            <span className="text-blue-900">min: {MIN_ADA} ADA</span>
          </div>
        </div>

        {/* Secret code / datum */}
        <div>
          <label className={labelCls}>
            {/* LEARNING: The datum is stored permanently in the UTxO output.
                It becomes the "lock" that the validator checks against the redeemer. */}
            Secret code (datum — the validator will check redeemer == this)
          </label>
          <input
            className={inputCls}
            type="number"
            value={secretCode}
            onChange={(e) => setSecretCode(e.target.value)}
            placeholder="e.g. 1234"
          />
        </div>

        {/* Lock button */}
        <button
          onClick={handleLock}
          disabled={!connected || status.type === "pending" || adaNum < MIN_ADA}
          className="w-full py-3 border border-[#0033AD] text-blue-300 hover:bg-[#0D2040] disabled:opacity-30 disabled:cursor-not-allowed transition-colors uppercase tracking-widest text-sm rounded-xl"
        >
          {status.type === "pending" ? "LOCKING…" : "⬛ LOCK INTO MACHINE"}
        </button>

        {status.type === "success" && (
          <div className="border border-[#0033AD] p-4 text-sm space-y-2 rounded-xl bg-[#0D2040]">
            <div className="text-green-400">✓ LOCKED</div>
            <div className="text-blue-400 text-xs break-all">
              {/* LEARNING: The tx hash is blake2b-256 of the serialised transaction body.
                  It is the unique, permanent identifier for this transaction on-chain. */}
              TX HASH: {status.txHash}
            </div>
            <a
              href={`${CARDANOSCAN_BASE}/transaction/${status.txHash}`}
              target="_blank"
              rel="noreferrer"
              className="text-blue-400 hover:text-blue-300 text-xs transition-colors"
            >
              View on Cardanoscan ↗
            </a>
          </div>
        )}

        {status.type === "error" && (
          <div className="border border-red-900 bg-red-950/30 p-3 text-red-400 text-sm rounded-lg">
            {status.message}
          </div>
        )}
      </section>

      {/* ── Current machine state ───────────────────────────────────── */}
      <section className="border border-[#162850] p-6 rounded-2xl bg-[#0A1730]">
        <div className="text-[#0033AD] text-xs mb-4 uppercase tracking-wider font-bold">
          [ MACHINE STATE — LOCKED UTxOs ]
        </div>
        <UTxODisplay refreshTrigger={refreshCounter} />
      </section>
    </div>
  )
}
