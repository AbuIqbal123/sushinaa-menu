import { BRANCHES, type BranchId } from '@/branches/branches';

export type BranchScope =
  | { kind: 'all' }
  | { kind: 'branch'; branchId: BranchId }
  | { kind: 'none' };

/** Every staff order query includes this predicate. */
export function branchClause(scope: BranchScope): { sql: string; args: string[] } {
  if (scope.kind === 'branch') return { sql: 'branch_id=?', args: [scope.branchId] };
  if (scope.kind === 'none') return { sql: 'branch_id IS NULL AND branch_id IS NOT NULL', args: [] };
  return { sql: 'branch_id IS NOT NULL', args: [] };
}

export function scopeFor(role: 'admin' | 'branch_staff', branchId: string | null): BranchScope {
  if (role === 'admin') return { kind: 'all' };
  const branch = BRANCHES.find((item) => item.slug === branchId);
  return branch ? { kind: 'branch', branchId: branch.slug } : { kind: 'none' };
}
