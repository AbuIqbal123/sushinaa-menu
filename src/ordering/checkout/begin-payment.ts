import { db } from '@/cms/db';
import { OrderError } from '@/ordering/http';
import { hash, initOrders } from './repository';
import { gateway } from '@/ordering/payment-gateway/resolve';
import type { CheckoutIntent, CheckoutLaunch } from '@/ordering/payment-gateway/types';
import { appendPaymentEvent, latestAttempt } from '@/ordering/ledger';
import { callbackHost, paymentLog } from '@/ordering/payment-log';

/**
 * Start hosted payment for a pickup order that is awaiting online pay.
 * Collection details already live on the order; this only launches Sadad (or mock).
 */
export async function beginHostedCheckout(
  orderId: string,
  session: string | null,
  language: 'en' | 'ar' = 'en',
  now = new Date(),
): Promise<CheckoutLaunch> {
  await initOrders();
  if (!session) throw new OrderError('NOT_FOUND', 404);
  const row = (await db.execute({
    sql: `SELECT id, status, payment_method, paid_at, total_minor, currency, snapshot, customer_phone
      FROM orders WHERE id=? AND session_hash=?`,
    args: [orderId, hash(session)],
  })).rows[0];
  if (!row) throw new OrderError('NOT_FOUND', 404);
  if (row.paid_at || row.status !== 'placed') throw new OrderError('INVALID_PAYMENT', 409);
  const method = String(row.payment_method);
  if (method !== 'sadad' && method !== 'mock') throw new OrderError('INVALID_PAYMENT', 409);

  const intent: CheckoutIntent = {
    orderId,
    amountMinor: Number(row.total_minor),
    currency: 'QAR',
    mobileDigits: String(row.customer_phone || '').replace(/\D/g, ''),
    language,
    line: {
      reference: orderId,
      amountMinor: Number(row.total_minor),
      quantity: 1,
    },
    txnAt: now,
  };

  const gw = gateway();
  if (method === 'sadad' && gw.name !== 'sadad') throw new OrderError('PAYMENT_NOT_CONNECTED', 503);
  const launch = await gw.begin(intent);
  const attempt = await latestAttempt(orderId);
  await appendPaymentEvent({
    orderId,
    attemptId: attempt ? String(attempt.id) : null,
    provider: method,
    kind: 'launch',
    ourStatus: 'awaiting_payment',
    providerReference: null,
    amountMinor: intent.amountMinor,
    eventKey: `launch:${orderId}:${now.toISOString()}`,
  }, now);
  paymentLog('info', {
    event: 'checkout.launch',
    orderId,
    provider: method,
    amountMinor: intent.amountMinor,
    website: launch.fields.WEBSITE,
    callbackHost: launch.fields.CALLBACK_URL ? callbackHost(launch.fields.CALLBACK_URL) : undefined,
    fieldNames: Object.keys(launch.fields).sort(),
  });
  return launch;
}
