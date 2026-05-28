// LEARNING: A validator is the on-chain script that guards a UTxO locked at its
// script address. Cardano runs this code when anyone tries to spend that UTxO.
// The inputs are: datum (stored with the UTxO by whoever locked it),
// redeemer (provided at spend time by whoever wants to unlock it),
// and the full transaction context.

use cardano/transaction.{OutputReference, Transaction}

validator vending_machine {
  // LEARNING: The 'spend' purpose fires when a UTxO at this script address is
  // consumed. datum is Option<Int> because Cardano allows UTxOs with no datum —
  // we treat that case as unspendable.
  spend(
    datum: Option<Int>,
    redeemer: Int,
    _utxo: OutputReference,
    _self: Transaction,
  ) {
    when datum is {
      // Succeed only when the submitted guess equals the stored secret code.
      // On Cardano, returning True = script passes; False = transaction rejected.
      Some(code) -> redeemer == code
      // If no datum was attached when locking, the UTxO is permanently locked.
      None -> False
    }
  }

  // LEARNING: The 'else' clause catches all non-spend script purposes
  // (minting, staking, voting, etc.). We reject them all — this contract
  // only does one thing: guard a UTxO with a secret number.
  else(_ctx) {
    False
  }
}
