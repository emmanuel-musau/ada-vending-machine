// BlockfrostProvider wraps every HTTP error as:
//   JSON.stringify({ data: { message, status_code, error }, headers, status })
// We unwrap it to get the actual message before pattern matching.
function extractMessage(raw: unknown): string {
  const str = raw instanceof Error ? raw.message : String(raw)
  try {
    const outer = JSON.parse(str)
    // Blockfrost wrapped error
    if (outer?.data?.message) return String(outer.data.message)
    // Evaluation error from MeshTxBuilder (stringified directly)
    if (outer?.message) return String(outer.message)
  } catch {
    // not JSON — use as-is
  }
  return str
}

export function parseCardanoError(raw: unknown): string {
  const msg = extractMessage(raw)

  // Wrong code — script returned False during evaluation or on-chain
  if (msg.includes("EvaluationFailure") || msg.includes("ScriptFailures")) {
    return "Wrong code — the validator rejected your guess. No funds were taken."
  }

  // UTxO already consumed by another transaction
  if (
    msg.includes("InputsExhausted") ||
    msg.toLowerCase().includes("already spent") ||
    msg.toLowerCase().includes("utxo not found")
  ) {
    return "This UTxO was already spent. Refresh to see current stock."
  }

  // Auto-selection found no suitable UTxO (thrown by pickCollateral)
  if (msg.toLowerCase().includes("no suitable collateral")) {
    return msg
  }

  // On-chain / protocol collateral errors (e.g. InsufficientCollateral, CollateralContainsNonADA)
  if (
    msg.toLowerCase().includes("collateral") ||
    msg.toLowerCase().includes("insufficientcollateral")
  ) {
    return "Collateral problem — the protocol rejected the collateral UTxO. Try a different pure-ADA UTxO or set one explicitly in your wallet settings."
  }

  // Insufficient funds / fee coverage
  if (
    msg.toLowerCase().includes("not enough ada") ||
    msg.toLowerCase().includes("insufficient") ||
    msg.toLowerCase().includes("lovelace is not sufficient")
  ) {
    return "Not enough ADA to cover the transaction fee."
  }

  // No UTxOs in wallet
  if (msg.toLowerCase().includes("no utxos")) {
    return "Wallet has no funds. Get test ADA from the Preview faucet."
  }

  // Minimum UTxO value
  if (msg.toLowerCase().includes("minimum") && msg.toLowerCase().includes("utxo")) {
    return "Amount is below the minimum UTxO value required by the protocol."
  }

  // User cancelled signing
  if (
    msg.toLowerCase().includes("user declined") ||
    msg.toLowerCase().includes("cancelled") ||
    msg.toLowerCase().includes("rejected by user")
  ) {
    return "Signing cancelled."
  }

  // Network error
  if (
    msg.toLowerCase().includes("network error") ||
    msg.toLowerCase().includes("failed to fetch")
  ) {
    return "Network error — check your connection and try again."
  }

  // Fallback: show the extracted message, trimmed
  return msg.length > 180 ? msg.slice(0, 180) + "…" : msg
}
