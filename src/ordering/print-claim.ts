/**
 * Kitchen print claim phases. State lives in columns, not a status enum:
 * unprinted → claimed → printed (reprint re-enters claimed from printed).
 */
export type PrintPhase = 'unprinted' | 'claimed' | 'printed';

export function printPhase(row: {
  print_count?: unknown;
  print_claim_id?: unknown;
  printed_at?: unknown;
}): PrintPhase {
  if (row.print_claim_id) return 'claimed';
  if (Number(row.print_count ?? 0) > 0 || row.printed_at != null) return 'printed';
  return 'unprinted';
}

export function autoClaimSetSql() {
  return `print_claim_id=?, print_claimed_at=?`;
}

/** Predicates after `id=? AND ${branch.sql}` — keep branch.sql in the caller for scope audits. */
export function autoClaimPredicate(printableSql: string) {
  return `print_count=0 AND print_claimed_at IS NULL AND ${printableSql} AND COALESCE(paid_at, created_at)>=?`;
}

export function manualClaimPredicate(printableSql: string) {
  return `print_count=0 AND ${printableSql} AND (print_claimed_at IS NULL OR print_claimed_at<=?)`;
}

export function reprintClaimPredicate(printableSql: string) {
  return `printed_at IS NOT NULL AND ${printableSql} AND (print_claimed_at IS NULL OR print_claimed_at<=?)`;
}

export function confirmPrintSetSql() {
  return `printed_at=COALESCE(printed_at, ?), print_count=print_count+1, print_claim_id=NULL, print_claimed_at=NULL`;
}

export function claimStillLive(claimedAtMs: number, nowMs: number, claimMs: number) {
  return Boolean(claimedAtMs) && nowMs - claimedAtMs < claimMs;
}
