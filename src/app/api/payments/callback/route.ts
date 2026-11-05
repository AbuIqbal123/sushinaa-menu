import { db } from '@/cms/db';
import { applyVerifiedFact } from '@/ordering/payments';
import { gateway, resolvePaymentProvider } from '@/ordering/payment-gateway/resolve';
import { BRANCHES } from '@/branches/branches';
import { initOrders } from '@/ordering/checkout/repository';
import { digestPayload, appendPaymentEvent } from '@/ordering/ledger';
import { callbackHost, paymentLog } from '@/ordering/payment-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function publicOrigin(request: Request) {
  const fromEnv = (process.env.SADAD_PUBLIC_ORIGIN || '').trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  return new URL(request.url).origin;
}

/**
 * Return the browser to our origin after Sadad POSTs the callback.
 * Absolute URL + 200 HTML (meta refresh + JS) — relative 303 Location has left
 * customers stuck on payment.sadadqa.com when the gateway mishandles redirects.
 */
function redirectTo(request: Request, path: string) {
  const location = path.startsWith('http')
    ? path
    : `${publicOrigin(request)}${path.startsWith('/') ? path : `/${path}`}`;
  const safe = location.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${safe}"><title>Returning to Sushinaa</title></head><body><p><a href="${safe}">Continue</a></p><script>location.replace(${JSON.stringify(location)})</script></body></html>`;
  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      Location: location,
    },
  });
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

/** Receipt return route — not the branch menu shell (avoids homepage flash after Sadad). */
function branchOrderPath(branchId: string | null | undefined) {
  const match = BRANCHES.find((b) => b.slug === branchId);
  const slug = match?.slug ?? BRANCHES[0]?.slug;
  return slug ? `/${slug}/order` : '/order';
}

async function handleCallback(request: Request, method: 'GET' | 'POST') {
  const fallback = branchOrderPath(null);
  try {
    if (resolvePaymentProvider() !== 'sadad') {
      paymentLog('warn', { event: 'callback.skipped', reason: 'provider_not_sadad', fieldNames: [method] });
      return redirectTo(request, fallback);
    }
    if (method === 'GET') {
      // Sadad documents HTTP POST. A GET means a misconfigured return or a probe.
      paymentLog('warn', {
        event: 'callback.get',
        reason: 'unexpected_get',
        callbackHost: callbackHost(request.url),
      });
      return redirectTo(request, `${fallback}?pay=failed`);
    }

    const body = await parseBody(request);
    const contentType = request.headers.get('content-type') || '';
    paymentLog('info', {
      event: 'callback.received',
      fieldNames: Object.keys(body).sort(),
      orderId: body.ORDERID || body.website_ref_no || undefined,
      outcome: body.transaction_status || body.STATUS || body.RESPCODE || undefined,
      reason: contentType ? `content-type:${contentType.split(';')[0]}` : 'content-type:missing',
      hasChecksum: Boolean(body.checksumhash),
    });

    let fact;
    try {
      fact = await gateway().verifyCallback(body);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'VERIFY_FAILED';
      paymentLog('error', {
        event: 'callback.verify_failed',
        reason,
        orderId: body.ORDERID || body.website_ref_no || undefined,
        fieldNames: Object.keys(body).sort(),
      });
      const orderId = body.ORDERID || body.website_ref_no;
      if (orderId) {
        await appendPaymentEvent({
          orderId,
          provider: 'sadad',
          kind: 'callback',
          ourStatus: 'failed',
          providerReference: body.transaction_number || null,
          eventKey: `callback:verify-failed:${digestPayload(body)}`,
          rawDigest: digestPayload(body),
        }).catch(() => {});
      }
      return redirectTo(request, `${fallback}?pay=failed`);
    }

    const result = await applyVerifiedFact(fact);
    paymentLog('info', {
      event: 'callback.applied',
      orderId: fact.orderId,
      provider: fact.provider,
      outcome: fact.outcome,
      amountMinor: fact.amountMinor,
      settled: 'settled' in result ? Boolean(result.settled) : false,
      reason: 'reason' in result ? String(result.reason) : undefined,
    });

    await initOrders();
    const order = (await db.execute({
      sql: 'SELECT branch_id FROM orders WHERE id=?',
      args: [fact.orderId],
    })).rows[0];
    const base = branchOrderPath(order ? String(order.branch_id) : null);
    // Customer recovers the pickup receipt via session + local order id.
    return redirectTo(request, `${base}?paid=${encodeURIComponent(fact.orderId)}`);
  } catch (error) {
    paymentLog('error', {
      event: 'callback.error',
      reason: error instanceof Error ? error.message : 'UNKNOWN',
    });
    return redirectTo(request, `${fallback}?pay=failed`);
  }
}

/** Sadad browser return after online pay for a pickup order. */
export async function POST(request: Request) {
  return handleCallback(request, 'POST');
}

/** Unexpected; logged so we can see misconfigured returns in Vercel logs. */
export async function GET(request: Request) {
  return handleCallback(request, 'GET');
}
