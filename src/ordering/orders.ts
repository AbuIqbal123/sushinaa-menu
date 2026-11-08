import { carBrandName } from './car-brands';
import { applyEdits, linesFromSnapshot, type ResolvedEdit } from './edits';
import type { DbRow } from '@/cms/sql';
import { db } from '@/cms/db';
import { auditInsert, type AuditContext } from '@/cms/audit';
import { initOrders, hash, customerOrder } from './checkout/repository';
import { activeStatuses, isPrintable, isTransitionEdge, printableStatuses, staffGroups, statusInSql, terminalStatuses, type OrderStatus, type StaffStatus } from './status';
import type { Role } from '@/cms/permissions';
import type { OrderQuery, StatusInput, OrderSummary, OrderDetailData } from './contracts';
import { OrderError } from './http';
import type { BranchId } from '@/branches/branches';
import { branchClause, type BranchScope } from './scope';
import { operationScope } from './operations-calendar';
import { counterSettlementStatements, mockProvider, settlePayment } from './payments';
import { releaseCouponStatement } from './coupons/repository';
import { AUTO_PRINT_WINDOW_MS } from './config';
import { afterChange } from './write';
import { KITCHEN_VISIBLE } from './visibility';
import { isProductionDeployment } from '@/lib/deploy-env';

export { KITCHEN_VISIBLE } from './visibility';
const text = (v: unknown) => typeof v === 'string' ? v : '';
const nullable = (v: unknown) => typeof v === 'string' ? v : null;

export async function orderEditMeta(orderId: string) {
  const edits = (await db.execute({
    sql: 'SELECT kind, line_id, reason_code, note FROM order_edits WHERE order_id=? ORDER BY created_at, id',
    args: [orderId],
  })).rows.map((row) => ({
    kind: String(row.kind),
    lineId: row.line_id == null ? null : String(row.line_id),
    reasonCode: String(row.reason_code),
    note: row.note == null ? null : String(row.note),
  }));
  const owed = (await db.execute({
    sql: 'SELECT COALESCE(SUM(amount_minor), 0) AS n FROM order_adjustments WHERE order_id=? AND settled_at IS NULL',
    args: [orderId],
  })).rows[0];
  return { edits, owedBackMinor: Number(owed?.n ?? 0) };
}
const printableSql = statusInSql(printableStatuses);
/** Last kitchen status change; falls back to paid/created for rows without audit. */
const STATUS_AT_SQL = `COALESCE((SELECT MAX(at) FROM audit WHERE entity_type='order' AND entity_id=orders.id AND action='order.status'),paid_at,created_at)`;
const LIVE_SORT_SQL = 'COALESCE(paid_at, created_at)';

export function summary(row: DbRow): OrderSummary {
  const name = typeof row.customer_name === 'string' && row.customer_name ? String(row.customer_name) : '—';
  const phone = typeof row.customer_phone === 'string' && row.customer_phone ? String(row.customer_phone) : '—';
  const plate = typeof row.car_plate === 'string' && row.car_plate ? String(row.car_plate) : '—';
  return { id: String(row.id), orderNumber: row.order_number == null ? null : Number(row.order_number),
    branchId: row.branch_id as BranchId, status: row.status as OrderStatus,
    paymentMethod: row.payment_method as OrderSummary['paymentMethod'], paidAt: nullable(row.paid_at),
    totalMinor: Number(row.total_minor), currency: 'QAR', createdAt: String(row.created_at),
    name, phone, plate,
    printCount: Number(row.print_count ?? 0), printedAt: nullable(row.printed_at),
    arrivedAt: nullable(row.customer_arrived_at) };
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
  // Branch staff keep their server scope; only owners may narrow via query.branch.
  const selectedScope = operationScope(scope, scope.kind === 'all' ? query.branch : undefined);
  const branch = branchClause(selectedScope);
  const where = [KITCHEN_VISIBLE, branch.sql];
  if (query.view) where.push(query.view === 'active' ? statusInSql(activeStatuses) : statusInSql(terminalStatuses));
  const args: (string | number)[] = [...branch.args];
  if (query.unprinted) where.push('print_count=0');
  if (query.status) {
    const states: readonly string[] = query.status in staffGroups ? staffGroups[query.status as StaffStatus] : [query.status];
    where.push(`status IN (${states.map(() => '?').join(',')})`);
    args.push(...states);
  }
  const dateColumn = query.view === 'history' ? STATUS_AT_SQL : 'created_at';
  if (query.from) { where.push(`${dateColumn}>=?`); args.push(new Date(`${query.from}T00:00:00+03:00`).toISOString()); }
  if (query.to) { where.push(`${dateColumn}<?`); args.push(new Date(Date.parse(`${query.to}T00:00:00+03:00`) + 86400000).toISOString()); }
  if (query.q) {
    if (query.q.startsWith('SU-') && /^SU-[0-9a-f-]{36}$/.test(query.q)) { where.push('id=?'); args.push(query.q); }
    else {
      const number = /^\d+$/.test(query.q) && Number.isSafeInteger(Number(query.q)) ? Number(query.q) : -1;
      where.push("(order_number=? OR instr(lower(COALESCE(customer_name,'')),lower(?))>0 OR instr(COALESCE(customer_phone,''),?)>0 OR instr(lower(COALESCE(car_plate,'')),lower(?))>0)");
      args.push(number,query.q,query.q,query.q);
    }
  }
  const backlog = await unprintedCount(selectedScope);
  let page = query.page;
  let followCursor = false;
  if (query.since) {
    const cursor = (await db.execute({
      sql: `SELECT ${LIVE_SORT_SQL} AS sort_at, id FROM orders WHERE id=? AND ${branch.sql}`,
      args: [query.since, ...branch.args],
    })).rows[0];
    if (cursor) {
      followCursor = true;
      where.push(`(${LIVE_SORT_SQL}>? OR (${LIVE_SORT_SQL}=? AND id>?))`);
      args.push(String(cursor.sort_at), String(cursor.sort_at), query.since);
    } else {
      page = 1;
    }
  }
  const predicate = where.join(' AND ');
  // Live + history both newest-first. Live uses kitchen arrival (paid/created); history uses last status change.
  const orderBy = query.view === 'history' ? STATUS_AT_SQL : LIVE_SORT_SQL;
  const rows = await db.execute({
    sql: `SELECT id,branch_id,status,payment_method,paid_at,total_minor,created_at,updated_at,snapshot,instructions,customer_name,customer_phone,car_plate,order_number,print_count,printed_at,customer_arrived_at, ${STATUS_AT_SQL} status_at FROM orders WHERE ${branch.sql} AND ${predicate} ORDER BY ${orderBy} DESC, order_number DESC, id DESC LIMIT ? OFFSET ?`,
    args: [...branch.args, ...args, query.limit + 1, (page - 1) * query.limit],
  });
  const count = followCursor ? Number((await db.execute({ sql: `SELECT COUNT(*) AS n FROM orders WHERE ${branch.sql} AND ${predicate}`, args: [...branch.args, ...args] })).rows[0].n) : 0;
  const arrivedCount = query.arrivedSince
    ? Number((await db.execute({
      sql: `SELECT COUNT(*) AS n FROM orders WHERE ${KITCHEN_VISIBLE} AND ${branch.sql} AND customer_arrived_at>?`,
      args: [...branch.args, query.arrivedSince],
    })).rows[0].n)
    : 0;
  const cutoff = new Date(Date.now() - AUTO_PRINT_WINDOW_MS).toISOString();
  const autoPrint = (await db.execute({
    sql: `SELECT id,branch_id,status,payment_method,paid_at,total_minor,created_at,customer_name,customer_phone,car_plate,order_number,print_count,printed_at,customer_arrived_at
      FROM orders WHERE ${KITCHEN_VISIBLE} AND ${branch.sql} AND print_count=0 AND print_claimed_at IS NULL AND ${printableSql}
      AND ${LIVE_SORT_SQL}>=? ORDER BY ${LIVE_SORT_SQL}, id`,
    args: [...branch.args, cutoff],
  })).rows.map(row => summary(row));
  const visible = rows.rows.slice(0, query.limit);
  const edits = new Map<string, ResolvedEdit[]>();
  if (visible.length) {
    const result = await db.execute({sql:`SELECT order_id,payload FROM order_edits WHERE order_id IN (${visible.map(()=>'?').join(',')}) ORDER BY created_at,id`,args:visible.map(row=>String(row.id))});
    for (const row of result.rows) {const id=String(row.order_id);edits.set(id,[...(edits.get(id)??[]),JSON.parse(String(row.payload)) as ResolvedEdit]);}
  }
  const summaries = visible.map(row=>{
    const snapshot = JSON.parse(String(row.snapshot));
    const lines = applyEdits(linesFromSnapshot(snapshot.lines??[]),edits.get(String(row.id))??[]).lines.filter(line=>!line.voided);
    return {...summary(row),updatedAt:String(row.updated_at??row.created_at),statusAt:String(row.status_at??row.created_at),brandId:String(snapshot.customer?.brand??''),
      items:lines.slice(0,3).map(line=>({dishId:line.dishId,name:line.name,nameAr:line.nameAr,quantity:line.quantity,selection:line.selection})),
      itemCount:lines.reduce((sum,line)=>sum+line.quantity,0),hasNotes:lines.some(line=>Boolean(line.note))||Boolean(row.instructions)};
  });
  return { rows: summaries, more: rows.rows.length > query.limit, page, newCount: count, arrivedCount, unprintedCount: backlog, autoPrint };
}

export async function detailOrder(scope: BranchScope, id: string): Promise<OrderDetailData> {
  await initOrders();
  const branch = branchClause(scope);
  const row = (await db.execute({ sql: `SELECT * FROM orders WHERE id=? AND ${branch.sql} AND ${KITCHEN_VISIBLE}`, args: [id, ...branch.args] })).rows[0];
  if (!row) throw new OrderError('NOT_FOUND', 404);
  const history = (await db.execute({ sql: "SELECT at,diff,label FROM audit WHERE entity_type='order' AND entity_id=? AND action='order.status' ORDER BY at DESC, id DESC", args: [id] })).rows;
  const snapshot = JSON.parse(String(row.snapshot));
  const brandId = text(snapshot.customer?.brand);
  const brand = carBrandName(brandId);
  delete snapshot.customer;
  const { applyEdits, linesFromSnapshot } = await import('./edits');
  const { storedEdits } = await import('./order-edits');
  const projected = applyEdits(linesFromSnapshot(snapshot.lines ?? []), await storedEdits(id));
  const meta = await orderEditMeta(id);
  return { ...summary(row), brandId, contactRevealed: true, snapshot, amendedAt: nullable(row.amended_at), originalTotalMinor: Number(snapshot.totalMinor ?? row.total_minor), currentLines: projected.lines, discounts: projected.discounts, edits: meta.edits, owedBackMinor: meta.owedBackMinor,
    customer: { name: text(row.customer_name), phone: text(row.customer_phone),
      plate: text(row.car_plate), colour: text(row.car_colour), brand, car: text(row.car_model), instructions: text(row.instructions) },
    history: history.map(h => ({ at: String(h.at), ...JSON.parse(String(h.diff)).status, reason: nullable(h.label) })),
  };
}

export async function transitionOrder(scope: BranchScope, id: string, input: StatusInput, ctx: AuditContext, now = new Date(), role: Role = 'branch_staff') {
  await initOrders();
  const branch = branchClause(scope);
  if (input.to === 'refunded' && role !== 'admin') throw new OrderError('FORBIDDEN', 403);
  // paid_at for refunded / counter-complete is enforced in the UPDATE below — do not fake it here.
  if (!isTransitionEdge(input.expected, input.to)) throw new OrderError('INVALID_TRANSITION', 409);
  if (input.to === 'refunded' && isProductionDeployment()) throw new OrderError('INVALID_TRANSITION', 409);
  const at = now.toISOString();
  const settled = input.to === 'completed' && input.recordPayment === true
    ? (await db.execute({ sql: `SELECT total_minor FROM orders WHERE id=? AND ${branch.sql}`, args: [id, ...branch.args] })).rows[0]
    : undefined;
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
    afterChange(auditInsert(ctx, { action: 'order.status', entityType: 'order', entityId: id, label: input.to === 'cancelled' ? input.reason : undefined, diff: { status: { from: input.expected, to: input.to }, ...(settled ? { settledMinor: Number(settled.total_minor) } : {}) } })),
    ...(recordPayment ? counterSettlementStatements(id, at) : []),
    ...(input.to === 'cancelled' ? [releaseCouponStatement(id, at)] : []),
  ], 'write');
  if (result[0].rowsAffected !== 1) {
    const visible = (await db.execute({ sql: `SELECT id FROM orders WHERE id=? AND ${branch.sql}`, args: [id, ...branch.args] })).rows[0];
    throw new OrderError(visible ? 'STALE_STATUS' : 'NOT_FOUND', visible ? 409 : 404);
  }
}

export async function payMock(id: string, session: string | null, now = new Date()) {
  if (isProductionDeployment()) throw new OrderError('NOT_FOUND', 404);
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
    sql: `SELECT id,snapshot FROM orders WHERE purge_after<=? AND ${statusInSql(terminalStatuses)} AND customer_phone IS NOT NULL LIMIT ?`,
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
