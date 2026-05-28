import type { Metadata } from "next"
import { Geist_Mono } from "next/font/google"
import "./globals.css"
import Providers from "@/components/Providers"

// Use only the monospace font — consistent with the terminal aesthetic throughout the app
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
})

export const metadata: Metadata = {
  title: "ADA Vending Machine",
  description:
    "Cardano Plutus dApp learning project — lock ADA + tokens with a secret code, redeem with the correct guess. Preview testnet.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${geistMono.variable} h-full`}>
      <body
        className="min-h-full flex flex-col bg-black text-green-400 font-mono"
        suppressHydrationWarning
      >
        {/*
         * LEARNING: Providers wraps the app in MeshProvider, which supplies the
         * Mesh wallet context. Every component that calls useWallet() or renders
         * CardanoWallet reads from this context.
         */}
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
