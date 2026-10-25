import type { BranchId } from '@/branches/branches';

/** Placeholder until Abubaker confirms the first ordering branch. */
export const ORDERING_BRANCHES: readonly BranchId[] = ['down-town'];

export function orderingEnabled(branchId: string) {
  return (ORDERING_BRANCHES as readonly string[]).includes(branchId);
}
