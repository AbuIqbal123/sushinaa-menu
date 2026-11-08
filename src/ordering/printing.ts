import { randomUUID } from 'node:crypto';
import type { DbRow } from '@/cms/sql';
import { db } from '@/cms/db';
import { auditInsert, type AuditContext } from '@/cms/audit';
import { initOrders } from './checkout/repository';
import { KITCHEN_VISIBLE } from './visibility';
import { OrderError } from './http';
import { branchClause, type BranchScope } from './scope';
import { AUTO_PRINT_WINDOW_MS } from './config';
import { printableStatuses, statusInSql } from './status';
import { afterChange } from './write';
import {
  autoClaimPredicate,
  autoClaimSetSql,
  claimStillLive,
  confirmPrintSetSql,
  manualClaimPredicate,
  reprintClaimPredicate,
} from './print-claim';

const CLAIM_MS = 2 * 60 * 1000;
const printableSql = statusInSql(printableStatuses);

export async function claimPrint(scope: BranchScope, id: string, mode: 'auto' | 'manual' | 'reprint', now = new Date()) {
  await initOrders();
  const branch = branchClause(scope);
  const claimId = randomUUID();
  const at = now.toISOString();
  const stale = new Date(now.getTime() - CLAIM_MS).toISOString();
  const recent = new Date(now.getTime() - AUTO_PRINT_WINDOW_MS).toISOString();
  const predicate = mode === 'auto'
    ? autoClaimPredicate(printableSql)
    : mode === 'manual'
      ? manualClaimPredicate(printableSql)
      : reprintClaimPredicate(printableSql);
  const args = mode === 'auto'
    ? [claimId, at, id, ...branch.args, recent]
    : [claimId, at, id, ...branch.args, stale];
  const result = await db.execute({
    sql: `UPDATE orders SET ${autoClaimSetSql()} WHERE id=? AND ${branch.sql} AND ${predicate}`,
    args,
  });
  if (result.rowsAffected === 1) return { claimId };
  const row = (await db.execute({
    sql: `SELECT print_count, print_claimed_at FROM orders WHERE id=? AND ${branch.sql}`,
    args: [id, ...branch.args],
  })).rows[0];
  if (!row) throw new OrderError('NOT_FOUND', 404);
  const claimedAt = row.print_claimed_at ? Date.parse(String(row.print_claimed_at)) : 0;
  if (claimStillLive(claimedAt, now.getTime(), CLAIM_MS)) throw new OrderError('PRINT_IN_PROGRESS', 409);
  throw new OrderError('ALREADY_PRINTED', 409);
}

export async function confirmPrint(scope: BranchScope, id: string, claimId: string, ctx: AuditContext, now = new Date()) {
  await initOrders();
  const branch = branchClause(scope);
  const tx = await db.transaction('write');
  let committed = false;
  try {
    const row = (await tx.execute({
      sql: `SELECT printed_at, print_count FROM orders WHERE id=? AND ${branch.sql} AND print_claim_id=?`,
      args: [id, ...branch.args, claimId],
    })).rows[0];
    if (!row) throw new OrderError('STALE_CLAIM', 409);
    const at = now.toISOString();
    const reprint = row.printed_at != null;
    const count = Number(row.print_count) + 1;
    const result = await tx.batch([
      {
        sql: `UPDATE orders SET ${confirmPrintSetSql()} WHERE id=? AND ${branch.sql} AND print_claim_id=?`,
        args: [at, id, ...branch.args, claimId],
      },
      afterChange(auditInsert(ctx, {
        action: reprint ? 'order.reprinted' : 'order.printed',
        entityType: 'order',
        entityId: id,
        diff: { count },
      })),
    ]);
    if (result[0].rowsAffected !== 1) throw new OrderError('STALE_CLAIM', 409);
    await tx.commit();
    committed = true;
    return { count, reprint };
  } finally {
    if (!committed) await tx.rollback().catch(() => undefined);
    tx.close();
  }
}

export async function loadTicket(scope: BranchScope, id: string): Promise<DbRow> {
  await initOrders();
  const branch = branchClause(scope);
  const row = (await db.execute({
    sql: `SELECT * FROM orders WHERE id=? AND ${branch.sql} AND ${KITCHEN_VISIBLE}`,
    args: [id, ...branch.args],
  })).rows[0];
  if (!row) throw new OrderError('NOT_FOUND', 404);
  return row;
}
