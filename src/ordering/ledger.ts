import { createHash, randomUUID } from 'node:crypto';
import { db } from '@/cms/db';
import { initOrders } from './checkout/repository';
import type { PaymentStatus } from './payment-gateway/types';
import type { BranchId } from '@/branches/branches';

export type PaymentEventKind = 'launch' | 'callback' | 'webhook' | 'settled' | 'failed';

export type LedgerEventInput = {
  orderId: string;
  attemptId?: string | null;
  provider: string;
  kind: PaymentEventKind;
  ourStatus: PaymentStatus;
  providerReference?: string | null;
  amountMinor?: number | null;
  eventKey: string;
  rawDigest?: string | null;
};

export async function appendPaymentEvent(input: LedgerEventInput, now = new Date()) {
  await initOrders();
  const at = now.toISOString();
  await db.execute({
    sql: `INSERT OR IGNORE INTO payment_events
      (id, order_id, attempt_id, provider, kind, our_status, provider_reference, amount_minor, raw_digest, recorded_at, event_key)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    args: [
      randomUUID(),
      input.orderId,
      input.attemptId ?? null,
      input.provider,
      input.kind,
      input.ourStatus,
      input.providerReference ?? null,
      input.amountMinor ?? null,
      input.rawDigest ?? null,
      at,
      input.eventKey,
    ],
  });
}

export async function updateAttemptStatus(
  orderId: string,
  provider: string,
  status: PaymentStatus,
  reference: string | null,
  now = new Date(),
) {
  await initOrders();
  const at = now.toISOString();
  await db.execute({
    sql: `UPDATE payment_attempts SET status=?, updated_at=?, reference=COALESCE(?, reference)
      WHERE order_id=? AND provider=?`,
    args: [status, at, reference, orderId, provider],
  });
}

export async function latestAttempt(orderId: string) {
  await initOrders();
  return (await db.execute({
    sql: 'SELECT * FROM payment_attempts WHERE order_id=? ORDER BY created_at DESC LIMIT 1',
    args: [orderId],
  })).rows[0] ?? null;
}

export function digestPayload(raw: unknown) {
  return createHash('sha256').update(JSON.stringify(raw)).digest('hex');
}

export function sadadTxnSql(orderIdExpr: string) {
  return `(
    SELECT pe.provider_reference
    FROM payment_events pe
    WHERE pe.order_id = ${orderIdExpr}
      AND pe.provider = 'sadad'
      AND pe.our_status = 'paid'
      AND pe.provider_reference IS NOT NULL
      AND pe.provider_reference != ''
      AND pe.provider_reference NOT LIKE 'sadad-callback:%'
      AND pe.provider_reference NOT LIKE 'sadad-webhook:%'
    ORDER BY pe.recorded_at DESC
    LIMIT 1
  )`;
}

export type PaymentListRow = {
  orderId: string;
  orderNumber: number | null;
  branchId: BranchId;
  status: PaymentStatus | string;
  amountMinor: number;
  currency: 'QAR';
  provider: string;
  reference: string | null;
  recordedAt: string;
  customerName: string;
  customerPhone: string;
};

export type PaymentListQuery = {
  status?: string;
  branchId?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};

export async function listPayments(query: PaymentListQuery = {}) {
  await initOrders();
  const where: string[] = ["o.payment_method IN ('sadad','mock')"];
  const args: Array<string | number> = [];
  if (query.branchId) {
    where.push('o.branch_id=?');
    args.push(query.branchId);
  }
  if (query.status) {
    where.push('COALESCE(a.status, CASE WHEN o.paid_at IS NOT NULL THEN \'paid\' ELSE \'awaiting_payment\' END)=?');
    args.push(query.status);
  }
  if (query.from) {
    where.push('o.created_at>=?');
    args.push(query.from);
  }
  if (query.to) {
    where.push('o.created_at<?');
    args.push(query.to);
  }
  const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);
  const offset = Math.max(query.offset ?? 0, 0);
  const sql = `SELECT o.id, o.order_number, o.branch_id, o.total_minor, o.currency, o.created_at, o.paid_at,
      o.customer_name, o.customer_phone, o.payment_method,
      a.provider, a.status AS attempt_status, a.reference, a.updated_at AS attempt_updated
    FROM orders o
    LEFT JOIN payment_attempts a ON a.order_id = o.id
    WHERE ${where.join(' AND ')}
    ORDER BY o.created_at DESC
    LIMIT ? OFFSET ?`;
  const rows = (await db.execute({ sql, args: [...args, limit + 1, offset] })).rows;
  const more = rows.length > limit;
  const slice = more ? rows.slice(0, limit) : rows;
  const mapped: PaymentListRow[] = slice.map((row) => ({
    orderId: String(row.id),
    orderNumber: row.order_number == null ? null : Number(row.order_number),
    branchId: row.branch_id as BranchId,
    status: String(row.attempt_status || (row.paid_at ? 'paid' : 'awaiting_payment')),
    amountMinor: Number(row.total_minor),
    currency: 'QAR',
    provider: String(row.provider || row.payment_method),
    reference: row.reference == null ? null : String(row.reference),
    recordedAt: String(row.attempt_updated || row.created_at),
    customerName: String(row.customer_name || '—'),
    customerPhone: String(row.customer_phone || '—'),
  }));
  return { rows: mapped, more };
}

export async function paymentDetail(orderId: string) {
  await initOrders();
  const order = (await db.execute({ sql: 'SELECT * FROM orders WHERE id=?', args: [orderId] })).rows[0];
  if (!order) return null;
  const attempt = await latestAttempt(orderId);
  const events = (await db.execute({
    sql: 'SELECT kind, our_status, provider_reference, amount_minor, recorded_at, provider FROM payment_events WHERE order_id=? ORDER BY recorded_at ASC',
    args: [orderId],
  })).rows;
  return {
    orderId: String(order.id),
    orderNumber: order.order_number == null ? null : Number(order.order_number),
    branchId: order.branch_id as BranchId,
    status: String(attempt?.status || (order.paid_at ? 'paid' : 'awaiting_payment')),
    amountMinor: Number(order.total_minor),
    currency: 'QAR' as const,
    provider: String(attempt?.provider || order.payment_method),
    reference: attempt?.reference == null ? null : String(attempt.reference),
    recordedAt: String(attempt?.updated_at || order.created_at),
    customerName: String(order.customer_name || '—'),
    customerPhone: String(order.customer_phone || '—'),
    history: events.map((e) => ({
      kind: String(e.kind),
      status: String(e.our_status),
      reference: e.provider_reference == null ? null : String(e.provider_reference),
      amountMinor: e.amount_minor == null ? null : Number(e.amount_minor),
      at: String(e.recorded_at),
      provider: String(e.provider),
    })),
  };
}
