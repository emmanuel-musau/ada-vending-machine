// LEARNING: app/page.tsx is the root page — it wires everything together.
//
// Two tabs:
//   VEND  — user-facing machine: connect wallet, enter code, redeem funds
//   ADMIN — operator panel: lock ADA + tokens into the contract

"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

// LEARNING: ssr: false is required here because VendingMachine and AdminPanel both
// import @meshsdk/core → @meshsdk/provider → @utxorpc/sdk → @connectrpc/connect,
// which has a version mismatch with @bufbuild/protobuf@2.x at the SSR layer.
// These components are purely client-side (they talk to a browser wallet via CIP-30),
// so skipping server-side rendering is both correct and necessary.
const VendingMachine = dynamic(() => import("@/components/VendingMachine"), {
  ssr: false,
});
const AdminPanel = dynamic(() => import("@/components/AdminPanel"), {
  ssr: false,
});

type Tab = "vend" | "admin";

export default function Home() {
  const [tab, setTab] = useState<Tab>("vend");

  return (
    <main className="min-h-screen bg-black text-green-400 font-mono p-4 md:p-8">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="mb-8 text-center">
        <p className="text-green-700 text-xs tracking-widest mt-2">
          CARDANO PLUTUS LEARNING DAPP — PREVIEW TESTNET
        </p>
        <p className="text-green-900 text-xs mt-1">
          validator: vending_machine.vending_machine.spend | network: preview
          testnet
        </p>
      </header>

      {/* ── Tab bar ─────────────────────────────────────────────────── */}
      <div className="flex border-b border-green-800 mb-8 max-w-2xl mx-auto">
        <button
          onClick={() => setTab("vend")}
          className={`px-6 py-2 text-sm uppercase tracking-widest border-b-2 transition-colors ${
            tab === "vend"
              ? "border-green-400 text-green-400"
              : "border-transparent text-green-800 hover:text-green-600"
          }`}
        >
          ▶ VEND
        </button>
        <button
          onClick={() => setTab("admin")}
          className={`px-6 py-2 text-sm uppercase tracking-widest border-b-2 transition-colors ${
            tab === "admin"
              ? "border-green-400 text-green-400"
              : "border-transparent text-green-800 hover:text-green-600"
          }`}
        >
          ⬛ ADMIN
        </button>
      </div>

      {/* ── Tab content ─────────────────────────────────────────────── */}
      {tab === "vend" && <VendingMachine />}
      {tab === "admin" && <AdminPanel />}

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="mt-16 text-center text-green-900 text-xs space-y-1">
        <p>
          built with{" "}
          <a
            href="https://aiken-lang.org"
            target="_blank"
            rel="noreferrer"
            className="text-green-700 hover:text-green-500"
          >
            Aiken
          </a>{" "}
          +{" "}
          <a
            href="https://meshjs.dev"
            target="_blank"
            rel="noreferrer"
            className="text-green-700 hover:text-green-500"
          >
            MeshSDK
          </a>{" "}
          +{" "}
          <a
            href="https://nextjs.org"
            target="_blank"
            rel="noreferrer"
            className="text-green-700 hover:text-green-500"
          >
            Next.js
          </a>
        </p>
        <p>
          validator source:{" "}
          <code className="text-green-800">
            smart-contract/validators/vending_machine.ak
          </code>
        </p>
      </footer>
    </main>
  );
}
