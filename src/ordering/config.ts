import type { BranchId } from '@/branches/branches';

/** Placeholder until Abubaker confirms the first ordering branch. */
export const ORDERING_BRANCHES: readonly BranchId[] = ['down-town'];

/** Auto-print ignores printable orders older than this. Manual print stays available. */
export const AUTO_PRINT_WINDOW_MS = 2 * 60 * 60 * 1000;

export function orderingEnabled(branchId: string) {
  return (ORDERING_BRANCHES as readonly string[]).includes(branchId);
}
