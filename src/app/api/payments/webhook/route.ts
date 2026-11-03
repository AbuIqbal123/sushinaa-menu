import { applyVerifiedFact } from '@/ordering/payments';
import { gateway, resolvePaymentProvider } from '@/ordering/payment-gateway/resolve';
import { WEBHOOK_ACK } from '@/ordering/vendors/sadad';
import { rateAllowed } from '@/ordering/rate-limit';
import { auditContext } from '@/cms/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ack = () => Response.json(WEBHOOK_ACK, { status: 200, headers: { 'Cache-Control': 'no-store' } });

/** Authoritative Sadad settlement for online-paid pickup orders. */
export async function POST(request: Request) {
  try {
    if (resolvePaymentProvider() !== 'sadad') return ack();
    if (!await rateAllowed('checkout', auditContext(request, null).ip)) {
      return Response.json({ status: 'error' }, { status: 429 });
    }
    const raw = await request.json() as unknown;
    const fact = await gateway().verifyWebhook(raw);
    await applyVerifiedFact(fact);
    return ack();
  } catch {
    return Response.json({ status: 'error' }, { status: 400 });
  }
}
