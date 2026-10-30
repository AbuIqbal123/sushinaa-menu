import { createHash } from 'node:crypto';
import { db } from '@/cms/db';
import { initOrders } from './checkout/repository';
// Shared DB-backed counter, namespaced away from CMS sign-in counters. One atomic UPSERT.
export async function rateAllowed(scope: 'checkout' | 'staff' | 'mock', ip: string | null, now = Date.now(), limit = scope === 'staff' ? 120 : 60) {
  await initOrders();
  const key = `order:${scope}:${createHash('sha256').update(ip || 'unknown').digest('hex')}`;
  const window = 15 * 60 * 1000;
  const result = await db.execute({
    sql: `INSERT INTO login_attempts(key,failures,started) VALUES (?,1,?)
      ON CONFLICT(key) DO UPDATE SET failures=CASE WHEN started<=? THEN 1 ELSE failures+1 END,
      started=CASE WHEN started<=? THEN excluded.started ELSE started END
      RETURNING failures`, args: [key, now, now - window, now - window],
  });
  return Number(result.rows[0].failures) <= limit;
}
