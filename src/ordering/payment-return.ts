/**
 * Browser return after Sadad callback: only a paid + settled fact recovers the
 * receipt. Failed/cancelled outcomes and amount mismatches must not use `?paid=`.
 */
export function callbackReturnKind(
  outcome: string,
  result: { settled?: boolean; alreadyPaid?: boolean } | { applied: false; reason?: string },
): 'paid' | 'failed' {
  if (!('settled' in result) && !('alreadyPaid' in result)) return 'failed';
  if (outcome === 'paid' && (Boolean(result.settled) || Boolean(result.alreadyPaid))) return 'paid';
  return 'failed';
}
