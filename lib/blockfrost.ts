// LEARNING: Blockfrost is an HTTP API that lets us read blockchain data without
// running a full Cardano node. We use it to fetch UTxOs sitting at the script
// address (what's locked in the machine).
//
// All requests go through /api/utxos/[address] — our own Next.js route that
// proxies Blockfrost and translates 404 (empty address) into 200 + [].
// This keeps the browser console free of spurious network errors.

// Each amount entry is {unit:"lovelace"|"<policyId><assetNameHex>", quantity:"N"}
export type BfAmount = { unit: string; quantity: string }

// A UTxO as returned by Blockfrost's address UTxO endpoint
export type BfUtxo = {
  tx_hash: string
  tx_index: number
  amount: BfAmount[]
  // inline_datum is the CBOR hex of the datum stored directly in the UTxO output.
  // This is what the validator reads as its `datum` argument.
  inline_datum: string | null
  data_hash: string | null
}

async function fetchUtxos(address: string): Promise<BfUtxo[]> {
  const res = await fetch(`/api/utxos/${address}`)
  if (!res.ok) throw new Error(`UTxO fetch failed: ${res.status}`)
  return res.json() as Promise<BfUtxo[]>
}

// Fetch all UTxOs currently locked at the vending machine script address
export async function fetchScriptUtxos(scriptAddress: string): Promise<BfUtxo[]> {
  return fetchUtxos(scriptAddress)
}

// Fetch all UTxOs at a wallet address (for displaying balances)
export async function fetchAddressUtxos(address: string): Promise<BfUtxo[]> {
  return fetchUtxos(address)
}
