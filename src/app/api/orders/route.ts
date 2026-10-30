import { readMenu } from '@/cms/repository';
import { auditContext } from '@/cms/audit';
import { checkoutSchema, quoteOrder } from '@/ordering/checkout/validation';
import { hash, existingOrder, persistPendingOrder, customerOrder } from '@/ordering/checkout/repository';
import { orderingEnabled } from '@/ordering/config';
import { reply, failure, provider, writeAccess, jsonBody, OrderError } from '@/ordering/http';
import { orderSession } from '@/ordering/session';
import { rateAllowed } from '@/ordering/rate-limit';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const paymentProvider = provider();
    await orderSession(true);
    return reply({ paymentProvider });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    const paymentProvider = provider(); writeAccess(request);
    const key = request.headers.get('idempotency-key');
    if (!key || !/^[a-zA-Z0-9-]{16,80}$/.test(key)) throw new OrderError('INVALID', 400);
    const parsed = checkoutSchema.parse(await jsonBody(request));
    if (!orderingEnabled(parsed.branchId)) throw new OrderError('BRANCH_UNAVAILABLE', 409);
    const session = await orderSession();
    if (!session) throw new OrderError('SESSION_REQUIRED', 401);
    if (!await rateAllowed('checkout', auditContext(request, null).ip)) throw new OrderError('RATE_LIMIT', 429);
    const method = parsed.paymentMethod || (paymentProvider === 'mock' ? 'mock' : 'pay_at_pickup');
    if (method === 'mock' && paymentProvider !== 'mock') throw new OrderError('INVALID_PAYMENT', 400);
    const requestHash = hash(JSON.stringify({ ...parsed, paymentMethod: method }));
    const previous = await existingOrder(session, key, requestHash);
    if (previous) return reply({ ...await customerOrder(previous.id, session), reused: true });
    const { menu, revision } = await readMenu();
    const snapshot = quoteOrder(parsed, menu, new Date(), { allowClosed: method === 'mock' });
    const order = await persistPendingOrder(session, key, requestHash, snapshot, revision, method);
    return reply({ ...await customerOrder(order.id, session), reused: order.reused }, order.reused ? 200 : 201);
  } catch (error) { return failure(error); }
}
