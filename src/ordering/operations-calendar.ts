import type { BranchId } from '@/branches/branches';
import { OrderError } from './http';
import type { BranchScope } from './scope';
import type { OperationsQuery } from './operations-contracts';

const DAY = 86400000;

/** Calendar day in Qatar (UTC+3), as YYYY-MM-DD. */
export function qatarDate(at: Date) {
  return new Date(at.getTime() + 3 * 3600000).toISOString().slice(0, 10);
}

export function operationRange(query: OperationsQuery, now = new Date()) {
  const today = qatarDate(now);
  const midnight = Date.parse(`${today}T00:00:00+03:00`);
  let from: string;
  let to: string;
  if (query.period === 'custom') {
    from = query.from!;
    to = query.to!;
  } else if (query.period === 'yesterday') {
    from = to = qatarDate(new Date(midnight - 1));
  } else {
    to = today;
    from = qatarDate(new Date(midnight - (query.period === '7d' ? 6 : query.period === '30d' ? 29 : 0) * DAY));
  }
  const start = new Date(`${from}T00:00:00+03:00`);
  const end = new Date(Date.parse(`${to}T00:00:00+03:00`) + DAY);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start || end.getTime() - start.getTime() > 92 * DAY) {
    throw new OrderError('INVALID', 400);
  }
  return { from, to, start: start.toISOString(), end: end.toISOString(), hourly: from === to };
}

/** Narrow an owner scope to one branch; branch staff keep their own scope. */
export function operationScope(scope: BranchScope, branch?: BranchId) {
  if (scope.kind === 'branch' && branch && branch !== scope.branchId) throw new OrderError('FORBIDDEN', 403);
  return scope.kind === 'all' && branch ? { kind: 'branch' as const, branchId: branch } : scope;
}
