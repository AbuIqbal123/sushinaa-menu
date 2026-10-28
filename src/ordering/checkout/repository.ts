import { createHash, randomUUID } from 'node:crypto';
import type { OrderSnapshot } from './validation';
import type { CustomerReceiptDetails } from '../contracts';
import { CheckoutError } from './validation';
import { db, initDb, databaseUrl } from '@/cms/db';
import { assertOrderDatabaseAllowed } from '@/ordering/guard';
import type { PaymentMethod } from '@/ordering/status';
import { OrderError } from '@/ordering/http';
import { composeOrderNumber, orderSequence, qatarDay } from '@/ordering/order-number';
export async function initOrders() {
  assertOrderDatabaseAllowed(databaseUrl);
  await initDb();
}
export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export async function existingOrder(session: string, key: string, requestHash: string) {
  await initOrders();
  const row = (await db.execute({ sql: 'SELECT * FROM orders WHERE session_hash=? AND idempotency_key=?', args: [hash(session), key] })).rows[0];
  if (!row) return null;
  if (row.request_hash !== requestHash) throw new CheckoutError('CONFLICT');
  return customerResult(row, true);
}
export function customerResult(row: Record<string, unknown>, reused = false) {
  const paid = Boolean(row.paid_at);
  return { id: String(row.id), orderNumber: row.order_number == null ? null : Number(row.order_number),
    paymentStatus: paid ? 'paid' : row.payment_method === 'pay_at_pickup' ? 'pending' : Date.parse(String(row.created_at)) + 30 * 60000 <= Date.now() ? 'expired' : 'awaiting_payment',
    status: String(row.status), paymentMethod: row.payment_method as PaymentMethod, totalMinor: Number(row.total_minor), currency: 'QAR' as const, reused };
}
export async function customerOrder(id: string, session: string | null) {
  await initOrders();
  if (!session) throw new OrderError('NOT_FOUND', 404);
  const row = (await db.execute({ sql: 'SELECT id,status,payment_method,paid_at,total_minor,created_at,order_number,branch_id,snapshot FROM orders WHERE id=? AND session_hash=?', args: [id, hash(session)] })).rows[0];
  if (!row) throw new OrderError('NOT_FOUND', 404);
  const snapshot = JSON.parse(String(row.snapshot)) as Partial<OrderSnapshot>;
  const { applyEdits, linesFromSnapshot } = await import('../edits');
  const { storedEdits } = await import('../order-edits');
  const projected = applyEdits(linesFromSnapshot(snapshot.lines ?? []), await storedEdits(id));
  const lines: CustomerReceiptDetails['lines'] = projected.lines.filter(line => !line.voided).map(line => ({
    id: line.id, name: line.name, nameAr: line.nameAr, quantity: line.quantity, note: line.note,
    unitMinor: line.unitMinor, totalMinor: line.unitMinor * line.quantity, selection: line.selection,
    kind: line.kind as CustomerReceiptDetails['lines'][number]['kind'],
    freeDips: line.freeDips as CustomerReceiptDetails['lines'][number]['freeDips'],
    extras: line.extras as CustomerReceiptDetails['lines'][number]['extras'],
  }));
  const details: CustomerReceiptDetails = { branchId: row.branch_id as CustomerReceiptDetails['branchId'],
    customer: snapshot.customer ?? null, lines,
    discountMinor: Math.max(0, lines.reduce((sum, line) => sum + line.totalMinor, 0) - Number(row.total_minor)),
  };
  return { ...customerResult(row), details };
}
export async function persistPendingOrder(session: string, key: string, requestHash: string, snapshot: OrderSnapshot, revision: number, method: PaymentMethod = 'mock') {
  await initOrders();
  const acquire = async () => {
    for (let n = 0; ; n++) {
      try { return await db.transaction('write'); }
      catch (error) {
        if (n >= 20 || !(error instanceof Error) || !('code' in error) || error.code !== 'SQLITE_BUSY') throw error;
        await new Promise(resolve => setTimeout(resolve, 20 * (n + 1)));
      }
    }
  };
  const tx = await acquire();
  try {
    const sessionHash = hash(session);
    const previous = (await tx.execute({ sql: 'SELECT * FROM orders WHERE session_hash=? AND idempotency_key=?', args: [sessionHash, key] })).rows[0];
    if (previous) {
      if (previous.request_hash !== requestHash) throw new CheckoutError('CONFLICT');
      await tx.commit();
      return customerResult(previous, true);
    }
    const count = (await tx.execute({ sql: 'SELECT COUNT(*) AS count FROM orders WHERE session_hash=? AND created_at>?', args: [sessionHash, new Date(Date.now() - 3600000).toISOString()] })).rows[0];
    if (Number(count.count) >= 10) throw new CheckoutError('LIMIT');
    const id = `SU-${randomUUID()}`;
    const now = new Date().toISOString();
    const day = qatarDay(new Date(now));
    const latest = (await tx.execute({
      sql: 'SELECT order_number FROM orders WHERE branch_id=? AND created_at>=? AND created_at<? AND order_number>=? ORDER BY order_number DESC LIMIT 1',
      args: [snapshot.branchId, day.start.toISOString(), day.end.toISOString(), 100_000],
    })).rows[0];
    const sequence = latest ? orderSequence(Number(latest.order_number)) + 1 : 1;
    if (sequence > 999) throw new CheckoutError('LIMIT');
    const orderNumber = composeOrderNumber(snapshot.branchId, day.day, sequence);
    await tx.batch([
      { sql: 'INSERT INTO orders (id,session_hash,idempotency_key,request_hash,snapshot,branch_id,order_number,total_minor,currency,customer_name,customer_phone,car_plate,car_colour,car_model,instructions,created_at,updated_at,payment_method) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        args: [id, sessionHash, key, requestHash, JSON.stringify({ version: 2, menuRevision: revision, ...snapshot }), snapshot.branchId, orderNumber, snapshot.totalMinor, snapshot.currency, snapshot.customer.name, snapshot.customer.phone, snapshot.customer.plate, snapshot.customer.colour, snapshot.customer.car, snapshot.customer.instructions, now, now, method] },
      ...(method === 'pay_at_pickup' ? [{ sql: "INSERT INTO order_outbox (id,order_id,event,created_at) VALUES (?,?,'order.placed',?)", args: [randomUUID(), id, now] }] :
        [{ sql: "INSERT INTO payment_attempts (id,order_id,provider,status,created_at,updated_at) VALUES (?,?,'mock','awaiting_payment',?,?)", args: [randomUUID(), id, now, now] }]),
    ]);
    await tx.commit();
    return customerResult({ id, status: 'placed', payment_method: method, total_minor: snapshot.totalMinor, created_at: now, order_number: orderNumber });
  } finally { tx.close(); }
}
