// This is a client-side wrapper for MeshProvider.
// Next.js App Router runs layouts on the server by default, but MeshProvider
// requires browser APIs (wallet detection via window.cardano). We isolate it
// here so the rest of layout.tsx stays as a Server Component.

"use client"

import { MeshProvider } from "@meshsdk/react"

export default function Providers({ children }: { children: React.ReactNode }) {
  // LEARNING: MeshProvider creates the React context that useWallet() reads.
  // It tracks which wallet is connected and exposes the BrowserWallet instance
  // to all descendant components without prop-drilling.
  return <MeshProvider>{children}</MeshProvider>
}
