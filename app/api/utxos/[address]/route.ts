// LEARNING: This API route proxies Blockfrost UTxO lookups through Next.js.
//
// Why proxy at all? Blockfrost returns HTTP 404 when an address has no UTxOs.
// The browser always logs non-2xx responses as console errors, even when
// JavaScript catches them gracefully. By routing through our own server we
// translate the 404 into HTTP 200 + empty array before it ever reaches the
// browser, keeping the console clean.
//
// Bonus: the `next: { revalidate: 15 }` fetch cache works on the *server*
// side here, so repeated client requests within 15 s share one Blockfrost call.

import { NextResponse } from "next/server"

const BLOCKFROST_BASE = "https://cardano-preview.blockfrost.io/api/v0"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params
  const key = process.env.NEXT_PUBLIC_BLOCKFROST_KEY
  if (!key) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_BLOCKFROST_KEY is not set" },
      { status: 500 }
    )
  }

  const res = await fetch(
    `${BLOCKFROST_BASE}/addresses/${address}/utxos`,
    {
      headers: { project_id: key },
      // LEARNING: revalidate caches this fetch on the server for 15 s.
      // Multiple browser requests within that window share one upstream call.
      next: { revalidate: 15 },
    }
  )

  // LEARNING: Blockfrost returns 404 for addresses that have never received
  // funds or currently hold no UTxOs. That is a valid "empty" state, not an
  // error — return an empty array with 200 so the browser never logs a network
  // error for a completely normal situation.
  if (res.status === 404) {
    return NextResponse.json([])
  }

  if (!res.ok) {
    return NextResponse.json(
      { error: `Blockfrost upstream error ${res.status}` },
      { status: 502 }
    )
  }

  const data = await res.json()
  return NextResponse.json(data)
}
