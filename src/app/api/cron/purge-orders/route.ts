import { createHash, timingSafeEqual } from 'node:crypto';
import { databaseUrl } from '@/cms/db';
import { assertOrderDatabaseAllowed } from '@/ordering/guard';
import { runScheduledPurge } from '@/ordering/orders';
import { reply, failure } from '@/ordering/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const actual = createHash('sha256').update(request.headers.get('authorization') ?? '').digest();
  const expected = createHash('sha256').update(`Bearer ${secret}`).digest();
  return timingSafeEqual(actual, expected);
}

export async function GET(request: Request) {
  try {
    assertOrderDatabaseAllowed(databaseUrl);
    if (!authorized(request)) return new Response(null, { status: 401, headers: { 'Cache-Control': 'no-store' } });
    return reply({ purged: await runScheduledPurge() });
  } catch (error) { return failure(error); }
}
