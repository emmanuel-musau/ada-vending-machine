// LEARNING: WalletConnector implements the CIP-30 wallet bridge manually.
//
// CIP-30 defines how browser dApps communicate with Cardano wallets. Every
// Cardano wallet extension (Eternl, Lace, Nami, Flint, etc.) injects a
// `window.cardano[name]` object that exposes:
//   • enable()           — request wallet access → returns the CIP-30 API
//   • getUtxos()         — list UTxOs the wallet controls (CBOR hex)
//   • signTx(hex, bool)  — ask the user to sign a transaction
//   • submitTx(hex)      — broadcast the signed tx to the network
//
// BrowserWallet.getInstalledWallets() enumerates window.cardano keys so we
// can show exactly which wallets the user already has installed.
// useWallet().connect(name) calls window.cardano[name].enable() under the hood
// and stores the resulting API in MeshProvider context.

"use client"

import { useState, useEffect, useRef } from "react"
import { useWallet } from "@meshsdk/react"
import { BrowserWallet, type Wallet } from "@meshsdk/core"

interface WalletConnectorProps {
  label?: string
}

export default function WalletConnector({ label }: WalletConnectorProps) {
  const { connected, connect, disconnect, name: connectedName } = useWallet()
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [showMenu, setShowMenu] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Detect installed CIP-30 wallets by scanning window.cardano
  useEffect(() => {
    const installed = BrowserWallet.getInstalledWallets()
    setWallets(installed)
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    if (showMenu) document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [showMenu])

  async function handleConnect(walletName: string) {
    setConnecting(true)
    setShowMenu(false)
    setError(null)
    try {
      // LEARNING: connect() calls window.cardano[walletName].enable(), which
      // triggers the browser extension's permission dialog. The user must approve
      // before any wallet API calls (getUtxos, signTx, etc.) are allowed.
      await connect(walletName)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Connection rejected")
    } finally {
      setConnecting(false)
    }
  }

  if (connected) {
    return (
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-green-400 text-sm">
          ✓ {connectedName ?? "wallet"} connected
        </span>
        <button
          onClick={() => disconnect()}
          className="border border-[#162850] text-blue-700 text-xs px-3 py-1.5 hover:border-[#0033AD] hover:text-blue-400 cursor-pointer transition-colors rounded-lg"
        >
          DISCONNECT
        </button>
      </div>
    )
  }

  const noWallets = wallets.length === 0
  const buttonLabel = connecting
    ? "CONNECTING…"
    : noWallets
    ? "NO WALLET DETECTED"
    : label ?? "CONNECT WALLET"

  return (
    <div className="relative inline-block" ref={menuRef}>
      <button
        onClick={() => {
          if (!connecting && !noWallets) setShowMenu((v) => !v)
        }}
        disabled={connecting || noWallets}
        className="border border-[#0033AD] text-blue-300 text-sm px-4 py-2 hover:bg-[#0D2040] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors tracking-widest uppercase rounded-xl"
      >
        {buttonLabel}
      </button>

      {/* Wallet selection dropdown */}
      {showMenu && (
        <div className="absolute top-full left-0 mt-2 z-50 bg-[#0A1730] border border-[#162850] min-w-48 rounded-xl overflow-hidden shadow-lg shadow-[#020A1A]/80">
          <div className="text-blue-700 text-xs px-3 py-2 border-b border-[#162850] uppercase tracking-widest">
            select wallet
          </div>
          {wallets.map((w) => (
            <button
              key={w.id}
              onClick={() => handleConnect(w.id)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-blue-500 hover:bg-[#0D2040] hover:text-blue-200 cursor-pointer transition-colors text-left"
            >
              {w.icon && (
                <img src={w.icon} alt="" className="w-5 h-5 rounded flex-shrink-0" />
              )}
              <span>{w.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* LEARNING: CIP-30 connect errors appear here — e.g. user denied the
          browser extension's permission popup */}
      {error && (
        <div className="mt-2 text-red-500 text-xs">{error}</div>
      )}

      {noWallets && (
        <div className="mt-2 text-blue-900 text-xs">
          Install a Cardano wallet extension (Eternl, Lace, Nami…) and reload.
        </div>
      )}
    </div>
  )
}
