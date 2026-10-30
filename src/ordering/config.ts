import { BRANCHES, type BranchId } from '@/branches/branches';

/** Every published branch takes orders. The order is stored on the branch the customer chose. */
export const ORDERING_BRANCHES: readonly BranchId[] = BRANCHES.map((branch) => branch.slug);

/** Auto-print ignores printable orders older than this. Manual print stays available. */
export const AUTO_PRINT_WINDOW_MS = 2 * 60 * 60 * 1000;

export function orderingEnabled(branchId: string) {
  return (ORDERING_BRANCHES as readonly string[]).includes(branchId);
}
