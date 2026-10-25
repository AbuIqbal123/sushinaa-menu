import { randomUUID } from 'node:crypto';
import { db } from '@/cms/db';
import { auditInsert } from '@/cms/audit';
import { initOrders } from './checkout/repository';
import { afterChange } from './write';

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

/**
 * The only write path that settles a payment.
 * It sets status and paid_at. It does not change created_at, totals, lines, or customer fields.
 */
export async function settlePayment(
  orderId: string,
  event: ProviderEvent,
  gate: { sessionHash: string; method: string },
  now = new Date(),
) {
  await initOrders();
  const at = now.toISOString();
  const result = await db.batch([
    {
      sql: `UPDATE orders SET status='paid', paid_at=?, updated_at=?
        WHERE id=? AND session_hash=? AND payment_method=? AND status='placed' AND paid_at IS NULL`,
      args: [at, at, orderId, gate.sessionHash, gate.method],
    },
    afterChange(auditInsert(
      { actor: `${event.provider}-gateway`, ip: null, userAgent: null },
      { action: 'order.status', entityType: 'order', entityId: orderId, diff: { status: { from: 'placed', to: 'paid' } } },
    )),
    { sql: "INSERT OR IGNORE INTO order_outbox (id,order_id,event,created_at) SELECT ?,?,'order.paid',? WHERE changes()=1", args: [randomUUID(), orderId, at] },
    { sql: "INSERT OR IGNORE INTO order_events (id,order_id,provider_event,type,created_at) SELECT ?,?,?,?,? WHERE changes()=1", args: [randomUUID(), orderId, event.reference, event.type, at] },
    { sql: "UPDATE payment_attempts SET status='paid', updated_at=?, reference=COALESCE(reference, ?) WHERE order_id=? AND provider=? AND changes()=1", args: [at, event.reference, orderId, event.provider] },
  ], 'write');
  return result[0].rowsAffected === 1;
}
