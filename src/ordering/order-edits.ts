import { randomUUID } from 'node:crypto';
import { db } from '@/cms/db';
import { auditInsert, type AuditContext } from '@/cms/audit';
import { readMenu } from '@/cms/repository';
import { publicMenu } from '@/cms/schema';
import type { Role } from '@/cms/permissions';
import { initOrders } from './checkout/repository';
import { validCheckoutSelection } from './checkout/validation';
import { unitPrice } from './price';
import { OrderError } from './http';
import { branchClause, type BranchScope } from './scope';
import type { OrderStatus } from './status';
import { afterChange } from './write';
import {
  applyEdits, cancelReasonFor, discountFrom, editableStatuses, linesFromSnapshot, parseEditBody,
  type EditBody, type ResolvedEdit, type WorkingLine,
} from './edits';

const KITCHEN_VISIBLE = "(payment_method='pay_at_pickup' OR paid_at IS NOT NULL)";

const editableSql = `status IN (${editableStatuses.map((status) => `'${status}'`).join(',')})`;

export async function storedEdits(orderId: string): Promise<ResolvedEdit[]> {
  const rows = (await db.execute({
    sql: 'SELECT payload FROM order_edits WHERE order_id=? ORDER BY created_at, id',
    args: [orderId],
  })).rows;
  return rows.map((row) => JSON.parse(String(row.payload)) as ResolvedEdit);
}

async function priceLine(dishId: string, selection: WorkingLine['selection'], quantity: number, note: string, id: string): Promise<WorkingLine> {
  const { menu } = await readMenu();
  const dish = publicMenu(menu).dishes.find((item) => item.id === dishId);
  if (!dish || !validCheckoutSelection(dish, selection)) throw new OrderError('UNAVAILABLE', 409);
  const category = menu.categories.find((item) => item.id === dish.section);
  const unitMinor = Math.round(unitPrice(dish, selection) * 100);
  return {
    id, dishId: dish.id, name: dish.name, nameAr: dish.nameAr, quantity, unitMinor, note,
    voided: false, compliment: false, discount: null, selection,
    categoryName: category?.name ?? 'Items', categoryNameAr: category?.nameAr ?? '', categoryOrder: category?.order ?? 0,
    kind: dish.kind, freeDips: dish.freeDips, extras: dish.extras,
  };
}

async function resolveEdit(body: EditBody, lines: WorkingLine[]): Promise<ResolvedEdit> {
  if (body.kind === 'add_item') {
    return { kind: 'add_item', line: await priceLine(body.dishId, body.selection, body.quantity, body.lineNote ?? '', `A-${randomUUID()}`) };
  }
  if (body.kind === 'modifier') {
    const current = lines.find((line) => line.id === body.lineId);
    if (!current) throw new OrderError('UNKNOWN_LINE', 409);
    const priced = await priceLine(current.dishId, body.selection, current.quantity, current.note, current.id);
    return { kind: 'modifier', lineId: body.lineId, selection: body.selection, unitMinor: priced.unitMinor };
  }
  if (body.kind === 'line_discount') return { kind: 'line_discount', lineId: body.lineId, discount: discountFrom(body) };
  if (body.kind === 'order_discount') return { kind: 'order_discount', discount: discountFrom(body) };
  if (body.kind === 'line_price') return { kind: 'line_price', lineId: body.lineId, unitMinor: body.unitMinor };
  if (body.kind === 'qty') return { kind: 'qty', lineId: body.lineId, quantity: body.quantity };
  if (body.kind === 'void') return { kind: 'void', lineId: body.lineId };
  return { kind: 'compliment', lineId: body.lineId };
}

export async function applyOrderEdit(scope: BranchScope, id: string, raw: unknown, ctx: AuditContext, role: Role, now = new Date()) {
  await initOrders();
  const body = parseEditBody(raw);
  if (body.kind === 'compliment' && role !== 'admin') throw new OrderError('FORBIDDEN', 403);
  const branch = branchClause(scope);
  const row = (await db.execute({
    sql: `SELECT snapshot, total_minor, status, paid_at FROM orders WHERE id=? AND ${branch.sql} AND ${KITCHEN_VISIBLE}`,
    args: [id, ...branch.args],
  })).rows[0];
  if (!row) throw new OrderError('NOT_FOUND', 404);
  const status = String(row.status);
  if (!editableStatuses.includes(status as typeof editableStatuses[number])) throw new OrderError('NOT_EDITABLE', 409);
  const snapshot = JSON.parse(String(row.snapshot)) as { lines?: Parameters<typeof linesFromSnapshot>[0] };
  const base = linesFromSnapshot(snapshot.lines ?? []);
  const prior = await storedEdits(id);
  const current = applyEdits(base, prior);
  let resolved: ResolvedEdit;
  let projected: ReturnType<typeof applyEdits>;
  try {
    resolved = await resolveEdit(body, current.lines);
    projected = applyEdits(base, [...prior, resolved]);
  } catch (error) {
    if (error instanceof OrderError) throw error;
    if (error instanceof Error && (error.message === 'BELOW_ZERO' || error.message === 'UNKNOWN_LINE')) throw new OrderError(error.message, 409);
    throw error;
  }
  const before = Number(row.total_minor);
  const after = projected.totalMinor;
  if (after < 0) throw new OrderError('BELOW_ZERO', 409);
  if (row.paid_at && after > before) throw new OrderError('INCREASE_ON_PAID_ORDER', 409);
  const at = now.toISOString();
  const editId = randomUUID();
  const note = body.note ? body.note : null;
  const adjustment = row.paid_at && before > after ? before - after : 0;
  const result = await db.batch([
    {
      sql: `UPDATE orders SET total_minor=?, amended_at=?, updated_at=?
        WHERE id=? AND ${branch.sql} AND ${editableSql} AND ${KITCHEN_VISIBLE}
        AND total_minor=? AND (paid_at IS NULL OR ?<=total_minor)`,
      args: [after, at, at, id, ...branch.args, before, after],
    },
    {
      sql: `INSERT INTO order_edits (id,order_id,kind,line_id,payload,reason_code,note,actor,before_total_minor,after_total_minor,created_at)
        SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE changes()=1`,
      args: [editId, id, resolved.kind, 'lineId' in resolved ? resolved.lineId : resolved.kind === 'add_item' ? resolved.line.id : null, JSON.stringify(resolved), body.reasonCode, note, ctx.actor, before, after, at],
    },
    afterChange(auditInsert(ctx, {
      action: 'order.edited', entityType: 'order', entityId: id, label: body.reasonCode,
      diff: { total: { from: before, to: after }, reason: body.reasonCode, note },
    })),
    {
      sql: `INSERT INTO order_adjustments (id,order_id,edit_id,amount_minor,created_at,settled_at)
        SELECT ?,?,?,?,?,NULL WHERE changes()=1 AND ?>0`,
      args: [randomUUID(), id, editId, adjustment, at, adjustment],
    },
  ], 'write');
  if (result[0].rowsAffected !== 1) {
    const latest = (await db.execute({
      sql: `SELECT status, paid_at, total_minor FROM orders WHERE id=? AND ${branch.sql}`,
      args: [id, ...branch.args],
    })).rows[0];
    if (!latest) throw new OrderError('NOT_FOUND', 404);
    if (latest.paid_at && after > Number(latest.total_minor)) throw new OrderError('INCREASE_ON_PAID_ORDER', 409);
    if (!editableStatuses.includes(String(latest.status) as typeof editableStatuses[number])) throw new OrderError('NOT_EDITABLE', 409);
    throw new OrderError('STALE_STATUS', 409);
  }
  const cancelled = resolved.kind === 'void' && projected.activeCount === 0;
  if (cancelled) {
    const { transitionOrder } = await import('./orders');
    await transitionOrder(scope, id, { expected: status as OrderStatus, to: 'cancelled', reason: cancelReasonFor[body.reasonCode] }, ctx, now, role);
  }
  return { totalMinor: after, lines: projected.lines, discounts: projected.discounts, cancelled };
}
