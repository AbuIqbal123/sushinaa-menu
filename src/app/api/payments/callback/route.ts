import { db } from '@/cms/db';
import { applyVerifiedFact } from '@/ordering/payments';
import { gateway, resolvePaymentProvider } from '@/ordering/payment-gateway/resolve';
import { BRANCHES } from '@/branches/branches';
import { initOrders } from '@/ordering/checkout/repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function redirectTo(path: string) {
  return new Response(null, { status: 303, headers: { Location: path, 'Cache-Control': 'no-store' } });
}

async function parseBody(request: Request): Promise<Record<string, string>> {
  const type = request.headers.get('content-type') || '';
  if (type.includes('application/json')) {
    const json = await request.json() as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(json)) if (v != null) out[k] = String(v);
    return out;
  }
  const text = await request.text();
  const params = new URLSearchParams(text);
  const out: Record<string, string> = {};
  for (const [k, v] of params.entries()) out[k] = v;
  return out;
}

function branchPath(branchId: string | null | undefined) {
  const match = BRANCHES.find((b) => b.slug === branchId);
  return match ? `/${match.slug}` : (BRANCHES[0]?.slug ? `/${BRANCHES[0].slug}` : '/');
}

/** Sadad browser return after online pay for a pickup order. */
export async function POST(request: Request) {
  const fallback = branchPath(null);
  try {
    if (resolvePaymentProvider() !== 'sadad') return redirectTo(fallback);
    const body = await parseBody(request);
    const fact = await gateway().verifyCallback(body);
    await applyVerifiedFact(fact);
    await initOrders();
    const order = (await db.execute({
      sql: 'SELECT branch_id FROM orders WHERE id=?',
      args: [fact.orderId],
    })).rows[0];
    const base = branchPath(order ? String(order.branch_id) : null);
    // Customer recovers the pickup receipt via session + local order id.
    return redirectTo(`${base}?paid=${encodeURIComponent(fact.orderId)}`);
  } catch {
    return redirectTo(`${fallback}?pay=failed`);
  }
}
