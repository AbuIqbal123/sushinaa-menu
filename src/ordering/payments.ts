import { randomUUID } from 'node:crypto';
import type { SqlStatement } from '@/cms/sql';
import { db } from '@/cms/db';
import { auditInsert } from '@/cms/audit';
import { initOrders } from './checkout/repository';
import { afterChange } from './write';
import { appendPaymentEvent, updateAttemptStatus } from './ledger';
import { redeemHeldCouponStatement } from './coupons/repository';
import type { VerifiedPaymentFact } from './payment-gateway/types';

export type ProviderEvent = { provider: string; reference: string; type: string };

/** A provider only describes the payment result. It does not write the order. */
export interface PaymentProvider {
  readonly name: string;
  eventFor(orderId: string): ProviderEvent;
}

export const mockProvider: PaymentProvider = {
  name: 'mock',
  eventFor(orderId) {
    return { provider: 'mock', reference: `mock:${orderId}`, type: 'mock.paid' };
  },
};

export const sadadProvider: PaymentProvider = {
  name: 'sadad',
  eventFor(orderId) {
    return { provider: 'sadad', reference: `sadad:${orderId}`, type: 'sadad.paid' };
  },
};

export type SettlementGate = {
  method: string;
  /** Customer mock-pay requires session. Webhook/callback omit it after crypto verify. */
  sessionHash?: string;
};

/**
 * The only write path that settles a payment.
 * It sets status and paid_at. It does not change created_at, totals, lines, or customer fields.
 */
export async function settlePayment(
  orderId: string,
  event: ProviderEvent,
  gate: SettlementGate,
  now = new Date(),
) {
  await initOrders();
  const at = now.toISOString();
  const sessionClause = gate.sessionHash
    ? 'AND session_hash=?'
    : '';
  const args = gate.sessionHash
    ? [at, at, orderId, gate.sessionHash, gate.method]
    : [at, at, orderId, gate.method];
  const result = await db.batch([
    {
      sql: `UPDATE orders SET status='paid', paid_at=?, updated_at=?
        WHERE id=? ${sessionClause} AND payment_method=? AND status='placed' AND paid_at IS NULL`,
      args,
    },
    afterChange(auditInsert(
      { actor: `${event.provider}-gateway`, ip: null, userAgent: null },
      { action: 'order.status', entityType: 'order', entityId: orderId, diff: { status: { from: 'placed', to: 'paid' } } },
    )),
    { sql: "INSERT OR IGNORE INTO order_outbox (id,order_id,event,created_at) SELECT ?,?,'order.paid',? WHERE changes()=1", args: [randomUUID(), orderId, at] },
    { sql: "INSERT OR IGNORE INTO order_events (id,order_id,provider_event,type,created_at) SELECT ?,?,?,?,? WHERE changes()=1", args: [randomUUID(), orderId, event.reference, event.type, at] },
    { sql: "UPDATE payment_attempts SET status='paid', updated_at=?, reference=COALESCE(reference, ?) WHERE order_id=? AND provider=? AND changes()=1", args: [at, event.reference, orderId, event.provider] },
    redeemHeldCouponStatement(orderId, at),
  ], 'write');
  return result[0].rowsAffected === 1;
}

/** Apply a verified vendor fact: ledger first, settle only when paid + amount matches. */
export async function applyVerifiedFact(fact: VerifiedPaymentFact, now = new Date()) {
  await initOrders();
  const order = (await db.execute({
    sql: 'SELECT id, total_minor, payment_method, paid_at, status FROM orders WHERE id=?',
    args: [fact.orderId],
  })).rows[0];
  if (!order) return { applied: false as const, reason: 'NOT_FOUND' as const };
  if (Number(order.total_minor) !== fact.amountMinor) {
    await appendPaymentEvent({
      orderId: fact.orderId,
      provider: fact.provider,
      kind: fact.eventKind,
      ourStatus: 'failed',
      providerReference: fact.reference,
      amountMinor: fact.amountMinor,
      eventKey: `${fact.eventKind}:amount-mismatch:${fact.reference}`,
    }, now);
    return { applied: false as const, reason: 'AMOUNT_MISMATCH' as const };
  }

  await appendPaymentEvent({
    orderId: fact.orderId,
    provider: fact.provider,
    kind: fact.eventKind,
    ourStatus: fact.ourStatus,
    providerReference: fact.reference,
    amountMinor: fact.amountMinor,
    eventKey: `${fact.eventKind}:${fact.reference}`,
  }, now);

  if (fact.outcome !== 'paid') {
    await updateAttemptStatus(fact.orderId, fact.provider, fact.ourStatus, fact.reference, now);
    return { applied: true as const, settled: false as const };
  }

  if (order.paid_at) return { applied: true as const, settled: false as const, alreadyPaid: true as const };

  const method = String(order.payment_method);
  const settled = await settlePayment(
    fact.orderId,
    { provider: fact.provider, reference: fact.reference, type: `${fact.provider}.paid` },
    { method },
    now,
  );
  if (settled) {
    await appendPaymentEvent({
      orderId: fact.orderId,
      provider: fact.provider,
      kind: 'settled',
      ourStatus: 'paid',
      providerReference: fact.reference,
      amountMinor: fact.amountMinor,
      eventKey: `settled:${fact.reference}`,
    }, now);
  }
  return { applied: true as const, settled };
}

/** Statements for a pay-at-pickup collection. The caller runs them in the status batch, after changes()=1. */
export function counterSettlementStatements(orderId: string, at: string): SqlStatement[] {
  return [
    {
      sql: `UPDATE orders SET paid_at=COALESCE(paid_at, ?) WHERE id=? AND payment_method='pay_at_pickup' AND changes()=1`,
      args: [at, orderId],
    },
    { sql: "INSERT OR IGNORE INTO order_outbox (id,order_id,event,created_at) SELECT ?,?,'order.paid',? WHERE changes()=1", args: [randomUUID(), orderId, at] },
    { sql: "INSERT OR IGNORE INTO order_events (id,order_id,provider_event,type,created_at) SELECT ?,?,?,?,? WHERE changes()=1", args: [randomUUID(), orderId, `counter:${orderId}`, 'counter.paid', at] },
    { sql: "UPDATE payment_attempts SET status='paid', updated_at=? WHERE order_id=? AND changes()=1", args: [at, orderId] },
    redeemHeldCouponStatement(orderId, at),
  ];
}
