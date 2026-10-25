import type { Row } from '@libsql/client';
import { db } from '@/cms/db';
import { auditInsert, type AuditContext } from '@/cms/audit';
import { initOrders, hash, customerOrder } from './checkout/repository';
import { canTransition, isPrintable, staffGroups, type OrderStatus, type StaffStatus } from './status';
import type { OrderQuery, StatusInput, OrderSummary, OrderDetailData } from './contracts';
import { OrderError } from './http';
import type { BranchId } from '@/branches/branches';
import { branchClause, type BranchScope } from './scope';
import { counterSettlementStatements, mockProvider, settlePayment } from './payments';
import { AUTO_PRINT_WINDOW_MS } from './config';
import { afterChange } from './write';

export const maskPhone = (phone: unknown) => typeof phone === 'string' && phone.length >= 4 ? `+974 •••• ${phone.slice(-4, -2)} ${phone.slice(-2)}` : '—';
export const maskPlate = (plate: unknown) => typeof plate === 'string' && plate.length >= 4 ? `${plate[0]} ••• ${plate.slice(-2)}` : '—';
const text = (v: unknown) => typeof v === 'string' ? v : '';
const nullable = (v: unknown) => typeof v === 'string' ? v : null;
export const KITCHEN_VISIBLE = "(payment_method='pay_at_pickup' OR paid_at IS NOT NULL)";
const printableSql = `status IN (${['paid', 'accepted', 'preparing', 'ready', 'completed'].map((status) => `'${status}'`).join(',')})`;

export function summary(row: Row): OrderSummary {
  return { id: String(row.id), orderNumber: row.order_number == null ? null : Number(row.order_number),
    branchId: row.branch_id as BranchId, status: row.status as OrderStatus,
    paymentMethod: row.payment_method as OrderSummary['paymentMethod'], paidAt: nullable(row.paid_at),
    totalMinor: Number(row.total_minor), currency: 'QAR', createdAt: String(row.created_at),
    phone: maskPhone(row.customer_phone), plate: maskPlate(row.car_plate),
    printCount: Number(row.print_count ?? 0), printedAt: nullable(row.printed_at) };
}

async function unprintedCount(scope: BranchScope) {
  const branch = branchClause(scope);
  const row = (await db.execute({
    sql: `SELECT COUNT(*) AS n FROM orders WHERE ${KITCHEN_VISIBLE} AND ${branch.sql} AND print_count=0 AND ${printableSql}`,
    args: branch.args,
  })).rows[0];
  return Number(row.n);
}

export async function listOrders(scope: BranchScope, query: OrderQuery) {
  await initOrders();
  const branch = branchClause(scope);
  const where = [KITCHEN_VISIBLE, branch.sql];
  const args: (string | number)[] = [...branch.args];
  if (query.status) {
    const states: readonly string[] = query.status in staffGroups ? staffGroups[query.status as StaffStatus] : [query.status];
    where.push(`status IN (${states.map(() => '?').join(',')})`);
    args.push(...states);
  }
  if (scope.kind === 'all' && query.branch) { where.push('branch_id=?'); args.push(query.branch); }
  if (query.from) { where.push('created_at>=?'); args.push(new Date(`${query.from}T00:00:00+03:00`).toISOString()); }
  if (query.to) { where.push('created_at<?'); args.push(new Date(Date.parse(`${query.to}T00:00:00+03:00`) + 86400000).toISOString()); }
  if (query.q) { where.push(query.q.startsWith('SU-') ? 'id=?' : 'substr(customer_phone,-4)=?'); args.push(query.q); }
  const backlog = await unprintedCount(scope);
  let page = query.page;
  let followCursor = false;
  if (query.since) {
    const cursor = (await db.execute({
      sql: `SELECT COALESCE(paid_at, created_at) AS sort_at, id FROM orders WHERE id=? AND ${branch.sql}`,
      args: [query.since, ...branch.args],
    })).rows[0];
    if (cursor) {
      followCursor = true;
      where.push('(COALESCE(paid_at, created_at)>? OR (COALESCE(paid_at, created_at)=? AND id>?))');
      args.push(String(cursor.sort_at), String(cursor.sort_at), query.since);
    } else {
      page = 1;
    }
  }
  const predicate = where.join(' AND ');
  const rows = await db.execute({
    sql: `SELECT id,branch_id,status,payment_method,paid_at,total_minor,created_at,customer_phone,car_plate,order_number,print_count,printed_at FROM orders WHERE ${branch.sql} AND ${predicate} ORDER BY COALESCE(paid_at, created_at) DESC, id DESC LIMIT ? OFFSET ?`,
    args: [...branch.args, ...args, query.limit + 1, (page - 1) * query.limit],
  });
  const count = followCursor ? Number((await db.execute({ sql: `SELECT COUNT(*) AS n FROM orders WHERE ${branch.sql} AND ${predicate}`, args: [...branch.args, ...args] })).rows[0].n) : 0;
  const cutoff = new Date(Date.now() - AUTO_PRINT_WINDOW_MS).toISOString();
  const autoPrint = (await db.execute({
    sql: `SELECT id,branch_id,status,payment_method,paid_at,total_minor,created_at,customer_phone,car_plate,order_number,print_count,printed_at
      FROM orders WHERE ${KITCHEN_VISIBLE} AND ${branch.sql} AND print_count=0 AND print_claimed_at IS NULL AND ${printableSql}
      AND COALESCE(paid_at, created_at)>=? ORDER BY COALESCE(paid_at, created_at), id`,
    args: [...branch.args, cutoff],
  })).rows.map(summary);
  return { rows: rows.rows.slice(0, query.limit).map(summary), more: rows.rows.length > query.limit, page, newCount: count, unprintedCount: backlog, autoPrint };
}

export async function detailOrder(scope: BranchScope, id: string, reveal: boolean, ctx: AuditContext): Promise<OrderDetailData> {
  await initOrders();
  const branch = branchClause(scope);
  const row = (await db.execute({ sql: `SELECT * FROM orders WHERE id=? AND ${branch.sql} AND ${KITCHEN_VISIBLE}`, args: [id, ...branch.args] })).rows[0];
  if (!row) throw new OrderError('NOT_FOUND', 404);
  if (reveal) await db.execute(auditInsert(ctx, { action: 'order.contact_viewed', entityType: 'order', entityId: id }));
  const history = (await db.execute({ sql: "SELECT at,diff,label FROM audit WHERE entity_type='order' AND entity_id=? AND action='order.status' ORDER BY id", args: [id] })).rows;
  const snapshot = JSON.parse(String(row.snapshot));
  delete snapshot.customer;
  return { ...summary(row), contactRevealed: reveal, snapshot,
    customer: { name: text(row.customer_name), phone: reveal ? text(row.customer_phone) : maskPhone(row.customer_phone),
      plate: reveal ? text(row.car_plate) : maskPlate(row.car_plate), colour: text(row.car_colour), car: text(row.car_model), instructions: text(row.instructions) },
    history: history.map(h => ({ at: String(h.at), ...JSON.parse(String(h.diff)).status, reason: nullable(h.label) })),
  };
}

export async function transitionOrder(scope: BranchScope, id: string, input: StatusInput, ctx: AuditContext, now = new Date()) {
  await initOrders();
  const branch = branchClause(scope);
  if (!canTransition(input.expected, input.to, 'sql-checks-paid-at')) throw new OrderError('INVALID_TRANSITION', 409);
  if (input.to === 'refunded' && process.env.VERCEL_ENV === 'production') throw new OrderError('INVALID_TRANSITION', 409);
  const at = now.toISOString();
  const purge = new Date(now.getTime() + 90 * 86400000).toISOString();
  const completed = input.to === 'completed';
  const recordPayment = completed && input.recordPayment === true;
  const result = await db.batch([
    { sql: `UPDATE orders SET status=?, updated_at=?,
        purge_after=CASE WHEN ? IN ('completed','cancelled') THEN ? ELSE purge_after END
        WHERE id=? AND ${branch.sql} AND status=? AND ${KITCHEN_VISIBLE}
        AND (?!='refunded' OR paid_at IS NOT NULL)
        AND (?!='completed' OR paid_at IS NOT NULL OR (payment_method='pay_at_pickup' AND ?=1))`,
      args: [input.to, at, input.to, purge, id, ...branch.args, input.expected, input.to, input.to, Number(recordPayment)] },
    afterChange(auditInsert(ctx, { action: 'order.status', entityType: 'order', entityId: id, label: input.to === 'cancelled' ? input.reason : undefined, diff: { status: { from: input.expected, to: input.to } } })),
    ...(recordPayment ? counterSettlementStatements(id, at) : []),
  ], 'write');
  if (result[0].rowsAffected !== 1) {
    const visible = (await db.execute({ sql: `SELECT id FROM orders WHERE id=? AND ${branch.sql}`, args: [id, ...branch.args] })).rows[0];
    throw new OrderError(visible ? 'STALE_STATUS' : 'NOT_FOUND', visible ? 409 : 404);
  }
}

export async function payMock(id: string, session: string | null, now = new Date()) {
  if (process.env.VERCEL_ENV === 'production') throw new OrderError('NOT_FOUND', 404);
  await initOrders();
  const current = await customerOrder(id, session);
  if (current.paymentMethod !== 'mock') throw new OrderError('INVALID_PAYMENT', 409);
  if (current.paymentStatus === 'paid') return current;
  if (current.paymentStatus === 'expired') throw new OrderError('EXPIRED', 409);
  const settled = await settlePayment(id, mockProvider.eventFor(id), { sessionHash: hash(session!), method: 'mock' }, now);
  const latest = await customerOrder(id, session);
  if (!settled && latest.paymentStatus !== 'paid') throw new OrderError('STALE_STATUS', 409);
  return latest;
}

/** Removes retained customer data. Reads do not call this. TODO(owner): confirm 90 days. */
export async function purgeOrders(now = new Date(), limit = 100) {
  await initOrders();
  const rows = (await db.execute({
    sql: "SELECT id,snapshot FROM orders WHERE purge_after<=? AND status IN ('completed','cancelled','refunded') AND customer_phone IS NOT NULL LIMIT ?",
    args: [now.toISOString(), limit],
  })).rows;
  for (const row of rows) {
    const snapshot = JSON.parse(String(row.snapshot));
    snapshot.customer = null;
    snapshot.lines = snapshot.lines.map((line: Record<string, unknown>) => ({ ...line, note: '' }));
    await db.execute({
      sql: 'UPDATE orders SET customer_name=NULL,customer_phone=NULL,car_plate=NULL,car_colour=NULL,car_model=NULL,instructions=NULL,snapshot=? WHERE id=? AND purge_after<=?',
      args: [JSON.stringify(snapshot), String(row.id), now.toISOString()],
    });
  }
  return rows.length;
}

export async function runScheduledPurge(deadline = Date.now() + 20_000, now = new Date()) {
  let count = 0;
  while (Date.now() < deadline) {
    const batch = await purgeOrders(now, 100);
    count += batch;
    if (batch < 100) break;
  }
  if (count > 0) {
    await db.execute(auditInsert(
      { actor: 'cron', ip: null, userAgent: null },
      { action: 'orders.purged', entityType: 'order', diff: { count } },
    ));
  }
  return count;
}

export { isPrintable };
