// LEARNING: VendingMachine demonstrates the "redeem" half — spending a script UTxO.
//
// Redeeming requires the user to provide:
//   • A redeemer: the integer guess (sent with the transaction)
//   • Collateral: a pure-ADA UTxO that gets slashed if the script fails on-chain
//
// The Cardano node will execute the Aiken validator with:
//   datum   = the integer stored in the locked UTxO
//   redeemer = the integer the user submits
// If redeemer == datum → script passes → funds released to the user.
// If redeemer != datum → script fails  → transaction rejected, collateral taken.
//
// PHASE-2 VALIDATION: Script execution happens AFTER the transaction is accepted
// into the mempool. This is why collateral exists — to deter submitting txs
// that will fail on-chain execution (those txs waste validator node resources).

"use client";

import { useEffect, useState, useCallback } from "react";
import { useWallet } from "@meshsdk/react";
import WalletConnector from "./WalletConnector";
import UTxODisplay from "./UTxODisplay";
import { buildRedeemTx, bfToMeshUtxo } from "@/lib/meshTx";
import { fetchScriptUtxos, type BfUtxo } from "@/lib/blockfrost";
import { SCRIPT_ADDRESS, CARDANOSCAN_BASE } from "@/lib/contract";
import { parseCardanoError } from "@/lib/errors";
import type { UTxO } from "@meshsdk/core";

type VendState = "idle" | "pending" | "dispensed" | "rejected" | "error";

export default function VendingMachine() {
  const { connected, wallet } = useWallet();
  const typedWallet =
    wallet as unknown as import("@/lib/meshTx").WalletInterface;

  const [guess, setGuess] = useState("");
  const [scriptUtxos, setScriptUtxos] = useState<BfUtxo[]>([]);
  const [selectedUtxo, setSelectedUtxo] = useState<BfUtxo | null>(null);
  const [vendState, setVendState] = useState<VendState>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);

  // Fetch UTxOs at the script address whenever the component mounts or refreshes.
  // LEARNING: selectedUtxo is intentionally NOT in deps — including it would cause
  // the callback to recreate after auto-selecting data[0], which would immediately
  // trigger the effect again and produce a redundant second fetch.
  const loadScriptUtxos = useCallback(async () => {
    const data = await fetchScriptUtxos(SCRIPT_ADDRESS);
    setScriptUtxos(data);
    // Use functional update so we only auto-select when nothing is selected yet,
    // without reading selectedUtxo as a dependency.
    setSelectedUtxo((prev) =>
      prev === null && data.length > 0 ? data[0] : prev,
    );
  }, []);

  useEffect(() => {
    loadScriptUtxos();
  }, [loadScriptUtxos, refreshCounter]);

  async function handleInsert() {
    if (!connected || !wallet) return;
    if (!selectedUtxo) {
      setErrorMsg("Select a UTxO from the stock list above.");
      return;
    }
    if (!guess || isNaN(Number(guess))) {
      setErrorMsg("Enter an integer code.");
      return;
    }

    setVendState("pending");
    setErrorMsg(null);
    setTxHash(null);

    // Convert Blockfrost UTxO format → Mesh UTxO format
    // LEARNING: MeshTxBuilder needs typed UTxO objects; Blockfrost returns plain JSON.
    const meshUtxo: UTxO = bfToMeshUtxo(
      selectedUtxo.tx_hash,
      selectedUtxo.tx_index,
      selectedUtxo.amount,
      SCRIPT_ADDRESS,
      selectedUtxo.inline_datum,
    );

    try {
      const hash = await buildRedeemTx(typedWallet, {
        scriptUtxo: meshUtxo,
        guess: Number(guess),
      });
      setTxHash(hash);
      setVendState("dispensed");
      setRefreshCounter((n) => n + 1);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      const friendly = parseCardanoError(e);
      const isScriptFailure =
        msg.includes("EvaluationFailure") ||
        msg.includes("ScriptFailures") ||
        msg.toLowerCase().includes("phase-2");
      setVendState(isScriptFailure ? "rejected" : "error");
      setErrorMsg(friendly);
    }
  }

  function reset() {
    setVendState("idle");
    setGuess("");
    setTxHash(null);
    setErrorMsg(null);
  }

  const isDispensed = vendState === "dispensed";
  const isRejected = vendState === "rejected";
  const isPending = vendState === "pending";

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* ── Wallet ─────────────────────────────────────────────────── */}
      <section className="border border-[#162850] p-6 rounded-2xl bg-[#0A1730]">
        <div className="text-[#0033AD] text-xs mb-4 uppercase tracking-wider font-bold">
          [ WALLET ]
        </div>
        <WalletConnector label="Connect Wallet" />
      </section>

      {/* ── Machine display ────────────────────────────────────────── */}
      <section
        className={`border-2 p-6 rounded-2xl transition-colors duration-300 ${
          isDispensed
            ? "border-green-400 bg-green-950"
            : isRejected
              ? "border-red-600 bg-red-950"
              : "border-[#162850] bg-[#0A1730]"
        }`}
      >
        {/* ASCII machine header */}
        <pre className="text-[#1A52D4] text-xs mb-6 select-none">
         {`ADA VENDING MACHINE${" "} <> Cardano Preview Testnet`}
        </pre>

        {/* Current stock — what's locked in the machine */}
        <div className="mb-5">
          <div className="text-blue-500 text-xs mb-3 uppercase tracking-wider">
            [ CURRENT STOCK ]
          </div>
          {scriptUtxos.length === 0 ? (
            <div className="text-blue-900 text-sm">machine is empty</div>
          ) : (
            <div className="space-y-2">
              {scriptUtxos.map((u) => {
                const ada = u.amount.find((a) => a.unit === "lovelace");
                const tokens = u.amount.filter((a) => a.unit !== "lovelace");
                return (
                  <button
                    key={`${u.tx_hash}-${u.tx_index}`}
                    onClick={() => setSelectedUtxo(u)}
                    className={`w-full text-left p-3 border rounded-lg text-xs transition-colors ${
                      selectedUtxo?.tx_hash === u.tx_hash
                        ? "border-[#0033AD] text-blue-100 bg-[#0D2040]"
                        : "border-[#0D2040] text-blue-800 hover:border-[#162850] hover:text-blue-500"
                    }`}
                  >
                    <span className="text-blue-400">
                      {u.tx_hash.slice(0, 12)}…#{u.tx_index}
                    </span>
                    {" | "}
                    {ada
                      ? `${(Number(ada.quantity) / 1e6).toFixed(2)} ADA`
                      : ""}
                    {tokens.length > 0 ? ` + ${tokens.length} token(s)` : ""}
                    {/* LEARNING: The raw datum hex is shown so devs can see exactly
                        what the validator will receive as its `datum` argument. */}
                    <span className="text-blue-700 ml-2">
                      datum: {u.inline_datum?.slice(0, 8) ?? "??"}…
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Separator */}
        <div className="text-[#162850] text-xs mb-5">
          ──────────────────────────────
        </div>

        {/* State display */}
        <div
          className={`text-center text-2xl font-bold mb-5 tracking-widest ${
            isDispensed
              ? "text-green-400"
              : isRejected
                ? "text-red-500"
                : isPending
                  ? "text-yellow-400 animate-pulse"
                  : "text-[#162850]"
          }`}
        >
          {isDispensed && "✓ DISPENSED"}
          {isRejected && "✗ REJECTED"}
          {isPending && "VALIDATING…"}
          {vendState === "idle" && "INSERT CODE"}
          {vendState === "error" && "ERROR"}
        </div>

        {/* Number input */}
        {(vendState === "idle" || vendState === "error") && (
          <div className="space-y-3">
            <input
              className="w-full bg-[#050D1F] border border-[#162850] text-blue-100 text-center text-xl px-4 py-3 focus:outline-none focus:border-[#0033AD] tracking-widest rounded-lg transition-colors"
              type="number"
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              placeholder="_ _ _ _"
              disabled={!connected}
            />

            {/* LEARNING: The redeemer is shown transparently so devs can see
                what value will be passed to the validator on-chain. */}
            {guess && (
              <div className="text-xs text-center text-blue-900">
                REDEEMER (raw): {`{ int: ${guess} }`}
                {" | "}
                CBOR:{" "}
                {Number(guess) <= 23
                  ? Number(guess).toString(16).padStart(2, "0")
                  : Number(guess) <= 255
                    ? `18${Number(guess).toString(16).padStart(2, "0")}`
                    : Number(guess) <= 65535
                      ? `19${Number(guess).toString(16).padStart(4, "0")}`
                      : "…"}
              </div>
            )}

            <button
              onClick={handleInsert}
              disabled={
                !connected || !guess || isPending || scriptUtxos.length === 0
              }
              className="w-full py-3 border border-[#0033AD] text-blue-300 hover:bg-[#0D2040] disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-lg tracking-widest rounded-xl"
            >
              ▶ INSERT
            </button>

            {errorMsg && (
              <div className="text-red-400 text-xs px-4 py-3 border border-red-900 bg-red-950/30 rounded-lg">
                {errorMsg}
              </div>
            )}
          </div>
        )}

        {/* Success state */}
        {isDispensed && txHash && (
          <div className="space-y-3 text-center">
            <div className="text-blue-400 text-xs break-all">TX: {txHash}</div>
            <a
              href={`${CARDANOSCAN_BASE}/transaction/${txHash}`}
              target="_blank"
              rel="noreferrer"
              className="text-blue-400 hover:text-blue-300 text-xs block transition-colors"
            >
              View on Cardanoscan ↗
            </a>
            <button
              onClick={reset}
              className="border border-green-700 text-green-600 px-4 py-2 text-xs hover:bg-green-950 rounded-lg transition-colors"
            >
              TRY AGAIN
            </button>
          </div>
        )}

        {/* Rejected state */}
        {isRejected && (
          <div className="space-y-3 text-center">
            <div className="text-red-400 text-sm px-4 py-3 border border-red-900 bg-red-950/30 rounded-lg">
              {errorMsg ?? "Wrong code — the validator rejected your guess."}
            </div>
            <button
              onClick={reset}
              className="border border-red-800 text-red-600 px-4 py-2 text-xs hover:bg-red-950 rounded-lg transition-colors"
            >
              TRY AGAIN
            </button>
          </div>
        )}
      </section>

      {/* ── Live UTxO inspector ─────────────────────────────────────── */}
      <section className="border border-[#162850] p-6 rounded-2xl bg-[#0A1730]">
        <div className="text-[#0033AD] text-xs mb-4 uppercase tracking-wider font-bold">
          [ UTxO INSPECTOR — SCRIPT ADDRESS ]
        </div>
        <UTxODisplay refreshTrigger={refreshCounter} />
      </section>
    </div>
  );
}
