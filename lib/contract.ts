// LEARNING: lib/contract.ts is the single source of truth for on-chain constants.
// The script CBOR is the compiled Plutus script from `aiken build` → plutus.json.
// The address is derived deterministically from the script hash — the same hash
// everyone sees on Cardanoscan when they inspect the contract.

// Raw compiled code from plutus.json: validators[].compiledCode
// for "vending_machine.vending_machine.spend"
// Run `aiken build` in smart-contract/ to regenerate.
export const SCRIPT_CBOR =
  "587701010029800aba2aba1aab9eaab9dab9a4888896600264646644b30013370e900118031baa00289919912cc004cdc3a400060126ea8006266e1cdd698058031bad300b300a375400314a08040c024004c024c028004c01cdd50014528200a30063007001300600230060013003375400d149a26cac8009"

// Script hash = blake2b-224(compiled_script). Appears in plutus.json under "hash".
// Also used as the payment credential for the script address.
export const SCRIPT_HASH = "24b88bbfd48748e8097c29f1a2e349a060a5c611a5a1a95526655293"

// Enterprise script address on Preview testnet:
// header 0x70 (type 7 = enterprise script, network 0 = testnet) + script_hash
// bech32_encode("addr_test", [0x70] + hex_decode(SCRIPT_HASH))
export const SCRIPT_ADDRESS =
  "addr_test1wqjt3zal6jr536qf0s5lrghrfxsxpfwxzxj6r224yej49ycg895qa"

// Cardano Preview testnet — all transactions here are free and won't spend real ADA.
export const NETWORK = "preview" as const

// Cardanoscan link for inspecting transactions on Preview testnet.
export const CARDANOSCAN_BASE = "https://preview.cardanoscan.io"
