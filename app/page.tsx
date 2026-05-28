// LEARNING: app/page.tsx is the root page — it wires everything together.
//
// Two tabs:
//   VEND  — user-facing machine: connect wallet, enter code, redeem funds
//   ADMIN — operator panel: lock ADA + tokens into the contract

"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

function TabLoader() {
  return (
    <div className="max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[420px] gap-4">
      <div className="relative">
        {/* Outer ping ring */}
        <span className="absolute inset-0 rounded-full animate-ping bg-[#0033AD]/20" />
        <img
          src="/cardano-favicon.png"
          alt=""
          className="relative w-14 h-14 rounded-full opacity-70 animate-pulse"
        />
      </div>
      <p className="text-[#162850] text-xs tracking-widest uppercase">
        loading…
      </p>
    </div>
  );
}

// LEARNING: ssr: false is required here because VendingMachine and AdminPanel both
// import @meshsdk/core → @meshsdk/provider → @utxorpc/sdk → @connectrpc/connect,
// which has a version mismatch with @bufbuild/protobuf@2.x at the SSR layer.
// These components are purely client-side (they talk to a browser wallet via CIP-30),
// so skipping server-side rendering is both correct and necessary.
const VendingMachine = dynamic(() => import("@/components/VendingMachine"), {
  ssr: false,
  loading: () => <TabLoader />,
});
const AdminPanel = dynamic(() => import("@/components/AdminPanel"), {
  ssr: false,
  loading: () => <TabLoader />,
});

type Tab = "vend" | "admin";

export default function Home() {
  const [tab, setTab] = useState<Tab>("vend");

  return (
    <main className="min-h-screen bg-[#050D1F] text-blue-300 font-mono p-4 md:p-8">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="mb-10 text-center">
        <h1 className="text-2xl font-bold tracking-widest text-blue-100 mb-2">
          ADA VENDING MACHINE
        </h1>
        <p className="text-blue-500/60 text-xs tracking-widest">
          CARDANO PLUTUS LEARNING DAPP — PREVIEW TESTNET
        </p>
        <p className="text-blue-900 text-xs mt-1">
          validator: vending_machine.vending_machine.spend | network: preview
          testnet
        </p>
      </header>

      {/* ── Tab bar ─────────────────────────────────────────────────── */}
      <div className="flex border-b border-[#162850] mb-10 max-w-2xl mx-auto">
        <button
          onClick={() => setTab("vend")}
          className={`px-6 py-3 text-sm uppercase tracking-widest border-b-2 transition-colors ${
            tab === "vend"
              ? "border-[#0033AD] text-blue-200"
              : "border-transparent text-blue-900 hover:text-blue-600"
          }`}
        >
          VENDER
        </button>
        <button
          onClick={() => setTab("admin")}
          className={`px-6 py-3 text-sm uppercase tracking-widest border-b-2 transition-colors ${
            tab === "admin"
              ? "border-[#0033AD] text-blue-200"
              : "border-transparent text-blue-900 hover:text-blue-600"
          }`}
        >
          ADMIN
        </button>
      </div>

      {/* ── Tab content ─────────────────────────────────────────────── */}
      {tab === "vend" && <VendingMachine />}
      {tab === "admin" && <AdminPanel />}

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="mt-20 text-center text-[#162850] text-xs space-y-1">
        <p>
          built with{" "}
          <a
            href="https://aiken-lang.org"
            target="_blank"
            rel="noreferrer"
            className="text-[#0033AD] hover:text-blue-400 transition-colors"
          >
            Aiken
          </a>{" "}
          +{" "}
          <a
            href="https://meshjs.dev"
            target="_blank"
            rel="noreferrer"
            className="text-[#0033AD] hover:text-blue-400 transition-colors"
          >
            MeshSDK
          </a>{" "}
          +{" "}
          <a
            href="https://nextjs.org"
            target="_blank"
            rel="noreferrer"
            className="text-[#0033AD] hover:text-blue-400 transition-colors"
          >
            Next.js
          </a>
        </p>
        <p>
          validator source:{" "}
          <code className="text-[#0A1730]">
            smart-contract/validators/vending_machine.ak
          </code>
        </p>
      </footer>
    </main>
  );
}
