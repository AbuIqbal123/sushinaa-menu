import { createHash, randomUUID } from 'node:crypto';
import type { OrderSnapshot } from './validation';
import { CheckoutError } from './validation';

import { db, initDb, databaseUrl } from '@/cms/db';
import { assertOrderDatabaseAllowed } from '@/ordering/guard';
export async function initOrders() {
  assertOrderDatabaseAllowed(databaseUrl);
  await initDb();
}
export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export async function persistPendingOrder(session: string, key: string, requestHash: string, snapshot: OrderSnapshot, revision: number) {
  await initOrders();
  // Local SQLite writers may overlap on retry/double tap. The unique key is the
  // durable guard; a bounded busy retry lets the second request read the first.
  const acquire = async () => {
    for (let n = 0; ; n++) {
      try { return await db.transaction('write'); }
      catch (error) {
        if (n >= 8 || !(error instanceof Error) || !('code' in error) || error.code !== 'SQLITE_BUSY') throw error;
        await new Promise(resolve => setTimeout(resolve, 25 * (n + 1)));
      }
    }
  };
  const tx = await acquire();
  try {
    const sessionHash = hash(session);
    const previous = (await tx.execute({ sql: 'SELECT id,request_hash,paid_at,created_at FROM orders WHERE session_hash=? AND idempotency_key=?', args: [sessionHash, key] })).rows[0];
    if (previous) {
      if (previous.request_hash !== requestHash) throw new CheckoutError('CONFLICT');
      await tx.commit();
      return { id: String(previous.id), paymentStatus: previous.paid_at ? 'paid' : Date.parse(String(previous.created_at)) + 30 * 60000 <= Date.now() ? 'expired' : 'awaiting_payment', reused: true };
    }
    const count = (await tx.execute({ sql: 'SELECT COUNT(*) AS count FROM orders WHERE session_hash=? AND created_at>?', args: [sessionHash, new Date(Date.now() - 3600000).toISOString()] })).rows[0];
    if (Number(count.count) >= 10) throw new CheckoutError('LIMIT');
    const id = `SU-${randomUUID()}`;
    const now = new Date().toISOString();
    await tx.execute({ sql: 'INSERT INTO orders (id,session_hash,idempotency_key,request_hash,snapshot,branch_id,total_minor,currency,customer_name,customer_phone,car_plate,car_colour,car_model,instructions,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      args: [id, sessionHash, key, requestHash, JSON.stringify({ version: 1, menuRevision: revision, ...snapshot }), snapshot.branchId, snapshot.totalMinor, snapshot.currency, snapshot.customer.name, snapshot.customer.phone, snapshot.customer.plate, snapshot.customer.colour, snapshot.customer.car, snapshot.customer.instructions, now, now] });
    await tx.commit();
    return { id, paymentStatus: 'awaiting_payment', reused: false };
  } finally { tx.close(); }
}
