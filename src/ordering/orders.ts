import { randomUUID } from 'node:crypto';
import type { InStatement, Row } from '@libsql/client';
import { db } from '@/cms/db';
import { auditInsert, type AuditContext } from '@/cms/audit';
import { initOrders, hash, customerOrder } from './checkout/repository';
import { canTransition, staffGroups, type OrderStatus, type StaffStatus } from './status';
import type { OrderQuery, StatusInput, OrderSummary, OrderDetailData } from './contracts';
import { OrderError } from './http';
import type { BranchId } from '@/branches/branches';

export const maskPhone = (phone: unknown) => typeof phone === 'string' && phone.length >= 4 ? `+974 •••• ${phone.slice(-4, -2)} ${phone.slice(-2)}` : '—';
export const maskPlate = (plate: unknown) => typeof plate === 'string' && plate.length >= 4 ? `${plate[0]} ••• ${plate.slice(-2)}` : '—';
const text = (v: unknown) => typeof v === 'string' ? v : '';
const nullable = (v: unknown) => typeof v === 'string' ? v : null;
export function summary(row: Row): OrderSummary {
  return { id: String(row.id), branchId: row.branch_id as BranchId, status: row.status as OrderStatus,
    paymentMethod: row.payment_method as OrderSummary['paymentMethod'], paidAt: nullable(row.paid_at),
    totalMinor: Number(row.total_minor), currency: 'QAR', createdAt: String(row.created_at),
    phone: maskPhone(row.customer_phone), plate: maskPlate(row.car_plate) };
}
// Unpaid mock attempts never reach the kitchen list.
const visible = "(payment_method='pay_at_pickup' OR paid_at IS NOT NULL)";
export async function listOrders(query: OrderQuery) {
  await initOrders();
  await purgeOrders();
  const where = [visible]; const args: (string | number)[] = [];
  if (query.status) {
    const states: readonly string[] = query.status in staffGroups ? staffGroups[query.status as StaffStatus] : [query.status];
    where.push(`status IN (${states.map(() => '?').join(',')})`); args.push(...states);
  }
  if (query.branch) { where.push('branch_id=?'); args.push(query.branch); }
  if (query.from) { where.push('created_at>=?'); args.push(new Date(`${query.from}T00:00:00+03:00`).toISOString()); }
  if (query.to) { where.push('created_at<?'); args.push(new Date(Date.parse(`${query.to}T00:00:00+03:00`) + 86400000).toISOString()); }
  if (query.q) { where.push(query.q.startsWith('SU-') ? 'id=?' : 'substr(customer_phone,-4)=?'); args.push(query.q); }
  if (query.since) {
    const cursor = (await db.execute({sql:'SELECT created_at,id FROM orders WHERE id=?', args:[query.since]})).rows[0];
    if (!cursor) throw new OrderError('INVALID_CURSOR', 400);
    where.push('(created_at>? OR (created_at=? AND id>?))'); args.push(String(cursor.created_at), String(cursor.created_at), query.since);
  }
  const predicate = where.join(' AND ');
  const rows = await db.execute({ sql: `SELECT id,branch_id,status,payment_method,paid_at,total_minor,created_at,customer_phone,car_plate FROM orders WHERE ${predicate} ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?`, args: [...args, query.limit + 1, (query.page - 1) * query.limit] });
  const count = query.since ? Number((await db.execute({sql:`SELECT COUNT(*) AS n FROM orders WHERE ${predicate}`,args})).rows[0].n) : 0;
  return { rows: rows.rows.slice(0, query.limit).map(summary), more: rows.rows.length > query.limit, page: query.page, newCount: count };
}
export async function detailOrder(id: string, reveal: boolean, ctx: AuditContext): Promise<OrderDetailData> {
  await initOrders(); await purgeOrders();
  const row = (await db.execute({ sql: `SELECT * FROM orders WHERE id=? AND ${visible}`, args: [id] })).rows[0];
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
// Each dependent INSERT is gated by the immediately preceding statement's changes().
// A stale UPDATE changes 0 rows, hence writes neither audit nor outbox rows.
function afterChange(statement: InStatement): InStatement {
  if (typeof statement === 'string') throw new Error('Expected a parameterized audit insert');
  return { ...statement, sql: statement.sql.replace('VALUES (?,?,?,?,?,?,?,?,?)', 'SELECT ?,?,?,?,?,?,?,?,? WHERE changes()=1') };
}
export async function transitionOrder(id: string, input: StatusInput, ctx: AuditContext, now = new Date()) {
  await initOrders();
  if (!canTransition(input.expected, input.to, 'sql-checks-paid-at')) throw new OrderError('INVALID_TRANSITION', 409);
  if (input.to === 'refunded' && process.env.VERCEL_ENV === 'production') throw new OrderError('INVALID_TRANSITION', 409);
  const at = now.toISOString(); const purge = new Date(now.getTime() + 90 * 86400000).toISOString();
  const completed = input.to === 'completed';
  const result = await db.batch([
    { sql: `UPDATE orders SET status=?, updated_at=?,
        paid_at=CASE WHEN ?=1 AND payment_method='pay_at_pickup' THEN COALESCE(paid_at,?) ELSE paid_at END,
        purge_after=CASE WHEN ? IN ('completed','cancelled') THEN ? ELSE purge_after END
        WHERE id=? AND status=? AND ${visible}
        AND (?!='refunded' OR paid_at IS NOT NULL)
        AND (?!='completed' OR paid_at IS NOT NULL OR (payment_method='pay_at_pickup' AND ?=1))`,
      args: [input.to, at, Number(completed && input.recordPayment === true), at, input.to, purge, id, input.expected, input.to, input.to, Number(input.recordPayment === true)] },
    afterChange(auditInsert(ctx, { action: 'order.status', entityType: 'order', entityId: id, label: input.to === 'cancelled' ? input.reason : undefined, diff: { status: { from: input.expected, to: input.to } } })),
    ...(completed ? [{ sql: "INSERT OR IGNORE INTO order_outbox (id,order_id,event,created_at) SELECT ?,?,'order.paid',? WHERE changes()=1", args: [randomUUID(), id, at] }] : []),
  ], 'write');
  if (result[0].rowsAffected !== 1) throw new OrderError('STALE_STATUS', 409);
}
export async function payMock(id: string, session: string | null) {
  if (process.env.VERCEL_ENV === 'production') throw new OrderError('NOT_FOUND', 404);
  await initOrders();
  const current = await customerOrder(id, session);
  if (current.paymentMethod !== 'mock') throw new OrderError('INVALID_PAYMENT', 409);
  if (current.paymentStatus === 'paid') return current;
  if (current.paymentStatus === 'expired') throw new OrderError('EXPIRED', 409);
  const at = new Date().toISOString();
  const result = await db.batch([
    { sql: "UPDATE orders SET status='paid',paid_at=?,updated_at=?,created_at=? WHERE id=? AND session_hash=? AND payment_method='mock' AND status='placed' AND paid_at IS NULL", args: [at, at, at, id, hash(session!)] },
    afterChange(auditInsert({ actor: 'mock-gateway', ip: null, userAgent: null }, { action: 'order.status', entityType: 'order', entityId: id, diff: { status: { from: 'placed', to: 'paid' } } })),
    { sql: "INSERT OR IGNORE INTO order_outbox (id,order_id,event,created_at) SELECT ?,?,'order.paid',? WHERE changes()=1", args: [randomUUID(), id, at] },
    { sql: "INSERT OR IGNORE INTO order_events (id,order_id,provider_event,type,created_at) SELECT ?,?,?,'mock.paid',? WHERE changes()=1", args: [randomUUID(), id, `mock:${id}`, at] },
    { sql: "UPDATE payment_attempts SET status='paid',updated_at=? WHERE order_id=? AND provider='mock' AND changes()=1", args: [at,id] },
  ], 'write');
  if (!result[0].rowsAffected) {
    const latest = await customerOrder(id, session);
    if (latest.paymentStatus !== 'paid') throw new OrderError('STALE_STATUS', 409);
    return latest;
  }
  return customerOrder(id, session);
}
/** Called on staff reads, and callable by a future retention scheduler. TODO(owner): confirm 90 days. */
export async function purgeOrders(now = new Date()) {
  await initOrders();
  const rows = (await db.execute({ sql: "SELECT id,snapshot FROM orders WHERE purge_after<=? AND status IN ('completed','cancelled','refunded') AND customer_phone IS NOT NULL LIMIT 100", args: [now.toISOString()] })).rows;
  for (const row of rows) {
    const snapshot = JSON.parse(String(row.snapshot)); snapshot.customer = null;
    snapshot.lines = snapshot.lines.map((line: Record<string, unknown>) => ({ ...line, note: '' }));
    await db.execute({ sql: 'UPDATE orders SET customer_name=NULL,customer_phone=NULL,car_plate=NULL,car_colour=NULL,car_model=NULL,instructions=NULL,snapshot=? WHERE id=? AND purge_after<=?', args: [JSON.stringify(snapshot), String(row.id), now.toISOString()] });
  }
  return rows.length;
}
