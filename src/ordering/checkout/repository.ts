import { createClient } from '@libsql/client';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { OrderSnapshot } from './validation';
import { CheckoutError } from './validation';

// Separate from the CMS database. Never silently use production CMS credentials.
const url = process.env.ORDER_DATABASE_URL || 'file:./data/orders.db';
if (process.env.VERCEL && url.startsWith('file:')) throw new Error('Configure a durable ORDER_DATABASE_URL before hosting ordering.');
if (url.startsWith('file:')) mkdirSync(dirname(url.slice(5)), { recursive: true });
const db = createClient({ url, authToken: process.env.ORDER_DATABASE_AUTH_TOKEN });
let ready: Promise<unknown> | undefined;
export function initOrders() {
  return ready ??= db.batch([
    `CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, session_hash TEXT NOT NULL, idempotency_key TEXT NOT NULL, request_hash TEXT NOT NULL, snapshot TEXT NOT NULL, payment_status TEXT NOT NULL DEFAULT 'awaiting_payment', fulfilment_status TEXT NOT NULL DEFAULT 'not_submitted', created_at TEXT NOT NULL, expires_at TEXT NOT NULL, UNIQUE(session_hash,idempotency_key))`,
    `CREATE TABLE IF NOT EXISTS payment_attempts (id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), provider TEXT NOT NULL, reference TEXT UNIQUE, status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS order_events (id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), provider_event TEXT UNIQUE, type TEXT NOT NULL, created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS order_outbox (id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), event TEXT NOT NULL, created_at TEXT NOT NULL, delivered_at TEXT, UNIQUE(order_id,event))`,
  ], 'write').catch(error => { ready = undefined; throw error; });
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
    const previous = (await tx.execute({ sql: 'SELECT id,request_hash,payment_status,expires_at FROM orders WHERE session_hash=? AND idempotency_key=?', args: [sessionHash, key] })).rows[0];
    if (previous) {
      if (previous.request_hash !== requestHash) throw new CheckoutError('CONFLICT');
      await tx.commit();
      return { id: String(previous.id), paymentStatus: new Date(String(previous.expires_at)) <= new Date() ? 'expired' : String(previous.payment_status), reused: true };
    }
    const count = (await tx.execute({ sql: 'SELECT COUNT(*) AS count FROM orders WHERE session_hash=? AND created_at>?', args: [sessionHash, new Date(Date.now() - 3600000).toISOString()] })).rows[0];
    if (Number(count.count) >= 10) throw new CheckoutError('LIMIT');
    const id = `SU-${randomUUID()}`;
    const now = new Date().toISOString();
    await tx.execute({ sql: 'INSERT INTO orders (id,session_hash,idempotency_key,request_hash,snapshot,created_at,expires_at) VALUES (?,?,?,?,?,?,?)',
      args: [id, sessionHash, key, requestHash, JSON.stringify({ version: 1, menuRevision: revision, ...snapshot }), now, new Date(Date.now() + 30 * 60000).toISOString()] });
    await tx.commit();
    return { id, paymentStatus: 'awaiting_payment', reused: false };
  } finally { tx.close(); }
}
