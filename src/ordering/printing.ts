import { randomUUID } from 'node:crypto';
import type { Row } from '@libsql/client';
import { db } from '@/cms/db';
import { auditInsert, type AuditContext } from '@/cms/audit';
import { initOrders } from './checkout/repository';
import { KITCHEN_VISIBLE } from './orders';
import { OrderError } from './http';
import { branchClause, type BranchScope } from './scope';
import { AUTO_PRINT_WINDOW_MS } from './config';
import { printableStatuses } from './status';
import { afterChange } from './write';

const CLAIM_MS = 2 * 60 * 1000;
const printableSql = `status IN (${printableStatuses.map((status) => `'${status}'`).join(',')})`;

export async function claimPrint(scope: BranchScope, id: string, mode: 'auto' | 'manual' | 'reprint', now = new Date()) {
  await initOrders();
  const branch = branchClause(scope);
  const claimId = randomUUID();
  const at = now.toISOString();
  const stale = new Date(now.getTime() - CLAIM_MS).toISOString();
  const recent = new Date(now.getTime() - AUTO_PRINT_WINDOW_MS).toISOString();
  const sql = mode === 'auto'
    ? `UPDATE orders SET print_claim_id=?, print_claimed_at=? WHERE id=? AND ${branch.sql} AND print_count=0 AND print_claimed_at IS NULL AND ${printableSql} AND COALESCE(paid_at, created_at)>=?`
    : mode === 'manual'
      ? `UPDATE orders SET print_claim_id=?, print_claimed_at=? WHERE id=? AND ${branch.sql} AND print_count=0 AND ${printableSql} AND (print_claimed_at IS NULL OR print_claimed_at<=?)`
      : `UPDATE orders SET print_claim_id=?, print_claimed_at=? WHERE id=? AND ${branch.sql} AND printed_at IS NOT NULL AND (print_claimed_at IS NULL OR print_claimed_at<=?)`;
  const args = mode === 'auto'
    ? [claimId, at, id, ...branch.args, recent]
    : [claimId, at, id, ...branch.args, stale];
  const result = await db.execute({ sql, args });
  if (result.rowsAffected === 1) return { claimId };
  const row = (await db.execute({
    sql: `SELECT print_count, print_claimed_at FROM orders WHERE id=? AND ${branch.sql}`,
    args: [id, ...branch.args],
  })).rows[0];
  if (!row) throw new OrderError('NOT_FOUND', 404);
  const claimedAt = row.print_claimed_at ? Date.parse(String(row.print_claimed_at)) : 0;
  if (claimedAt && now.getTime() - claimedAt < CLAIM_MS) throw new OrderError('PRINT_IN_PROGRESS', 409);
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
        sql: `UPDATE orders SET printed_at=COALESCE(printed_at, ?), print_count=print_count+1, print_claim_id=NULL, print_claimed_at=NULL
          WHERE id=? AND ${branch.sql} AND print_claim_id=?`,
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

export async function loadTicket(scope: BranchScope, id: string): Promise<Row> {
  await initOrders();
  const branch = branchClause(scope);
  const row = (await db.execute({
    sql: `SELECT * FROM orders WHERE id=? AND ${branch.sql} AND ${KITCHEN_VISIBLE}`,
    args: [id, ...branch.args],
  })).rows[0];
  if (!row) throw new OrderError('NOT_FOUND', 404);
  return row;
}
