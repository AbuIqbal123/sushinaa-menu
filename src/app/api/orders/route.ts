import { cookies } from 'next/headers';
import { randomBytes } from 'node:crypto';
import { sameOrigin } from '@/cms/auth';
import { readMenu } from '@/cms/repository';
import { checkoutSchema, CheckoutError, quoteOrder } from '@/ordering/checkout/validation';
import { hash, persistPendingOrder } from '@/ordering/checkout/repository';
import { beginHostedPayment } from '@/ordering/checkout/payment';
import { databaseUrl } from '@/cms/db';
import { orderDatabaseAllowed } from '@/ordering/guard';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
// This preview release cannot collect real orders in production, even if credentials are present.
const enabled = () => orderDatabaseAllowed(databaseUrl) && process.env.NODE_ENV !== 'production' && process.env.ORDERING_PREVIEW_ENABLED === 'true';
async function session() {
  const jar = await cookies();
  let token = jar.get('sushinaa-order-session')?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    token = randomBytes(32).toString('hex');
    jar.set('sushinaa-order-session', token, { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/api/orders', maxAge: 86400 });
  }
  return token;
}
export async function GET() {
  if (!enabled()) return reply({ code: 'ORDERING_UNAVAILABLE' }, 503);
  await session();
  return reply({ paymentAvailable: false });
}
export async function POST(request: Request) {
  if (!enabled()) return reply({ code: 'ORDERING_UNAVAILABLE' }, 503);
  if (!sameOrigin(request)) return reply({ code: 'FORBIDDEN' }, 403);
  if (!request.headers.get('content-type')?.startsWith('application/json')) return reply({ code: 'INVALID' }, 415);
  const key = request.headers.get('idempotency-key');
  if (!key || !/^[a-zA-Z0-9-]{16,80}$/.test(key)) return reply({ code: 'INVALID' }, 400);
  try {
    // Stream cap also protects requests without Content-Length.
    const reader = request.body?.getReader();
    if (!reader) return reply({ code: 'INVALID' }, 400);
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      size += chunk.value.length;
      if (size > 65536) { await reader.cancel(); return reply({ code: 'INVALID' }, 413); }
      chunks.push(chunk.value);
    }
    const parsed = checkoutSchema.safeParse(JSON.parse(Buffer.concat(chunks).toString('utf8')));
    if (!parsed.success) return reply({ code: 'INVALID', fields: parsed.error.issues.map(i => i.path.join('.')) }, 400);
    const { menu, revision } = await readMenu();
    const snapshot = quoteOrder(parsed.data, menu);
    const order = await persistPendingOrder(await session(), key, hash(JSON.stringify(parsed.data)), snapshot, revision);
    const payment = await beginHostedPayment(order.id);
    return reply({ ...order, totalMinor: snapshot.totalMinor, currency: 'QAR', payment }, order.reused ? 200 : 201);
  } catch (error) {
    if (error instanceof CheckoutError) return reply({ code: error.code }, 409);
    if (error instanceof SyntaxError) return reply({ code: 'INVALID' }, 400);
    return reply({ code: 'TEMPORARILY_UNAVAILABLE' }, 503);
  }
}
