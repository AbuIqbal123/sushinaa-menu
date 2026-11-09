import { applyVerifiedFact } from '@/ordering/payments';
import { gateway, resolvePaymentProvider } from '@/ordering/payment-gateway/resolve';
import { WEBHOOK_ACK } from '@/ordering/vendors/sadad';
import { rateAllowed } from '@/ordering/rate-limit';
import { auditContext } from '@/cms/audit';
import { paymentLog, sadadWebhookFields } from '@/ordering/payment-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ack = () => Response.json(WEBHOOK_ACK, { status: 200, headers: { 'Cache-Control': 'no-store' } });

/** Authoritative Sadad settlement for online-paid pickup orders. */
export async function POST(request: Request) {
  try {
    if (resolvePaymentProvider() !== 'sadad') {
      paymentLog('warn', { event: 'webhook.skipped', reason: 'provider_not_sadad' });
      return ack();
    }
    if (!await rateAllowed('checkout', auditContext(request, null).ip)) {
      paymentLog('warn', { event: 'webhook.rate_limited', httpStatus: 429 });
      return Response.json({ status: 'error' }, { status: 429 });
    }
    const raw = await request.json() as unknown;
    const fieldNames = raw && typeof raw === 'object' && !Array.isArray(raw)
      ? Object.keys(raw as object).sort()
      : [];
    const asStrings: Record<string, string | undefined> = {};
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
        if (value != null) asStrings[key] = String(value);
      }
    }
    const gatewayNote = sadadWebhookFields(asStrings);
    const orderHint = asStrings.websiteRefNo || undefined;
    paymentLog('info', {
      event: 'webhook.received',
      fieldNames,
      orderId: orderHint,
      ...gatewayNote,
    });

    let fact;
    try {
      fact = await gateway().verifyWebhook(raw);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'VERIFY_FAILED';
      // Log only: never write payment_events for unverified payloads. Those rows
      // feed failedPaymentCount and would let anyone with an order id lock the pay CTA.
      paymentLog('error', {
        event: 'webhook.verify_failed',
        reason,
        orderId: orderHint,
        fieldNames,
        ...gatewayNote,
      });
      return Response.json({ status: 'error' }, { status: 400 });
    }

    const result = await applyVerifiedFact(fact);
    paymentLog('info', {
      event: 'webhook.applied',
      orderId: fact.orderId,
      provider: fact.provider,
      outcome: fact.outcome,
      amountMinor: fact.amountMinor,
      settled: 'settled' in result ? Boolean(result.settled) : false,
      alreadyPaid: 'alreadyPaid' in result ? Boolean(result.alreadyPaid) : undefined,
      reason: 'reason' in result ? String(result.reason) : undefined,
      ...gatewayNote,
    });
    return ack();
  } catch (error) {
    paymentLog('error', {
      event: 'webhook.error',
      reason: error instanceof Error ? error.message : 'UNKNOWN',
    });
    return Response.json({ status: 'error' }, { status: 400 });
  }
}
