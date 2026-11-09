/**
 * Break-it: unsigned Sadad callback/webhook verify failures must not write
 * payment_events that inflate failedPaymentCount / the customer pay CTA lockout.
 * (Audit fingerprint payment-events:verify-failed-counts-toward-lockout)
 *
 * Note: no repo file named production-payments-checklist; this is the regression
 * for the confirmed payment verify-failure lockout path.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('unsigned callback and webhook verify failures do not raise failedPaymentCount', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sn-verify-fail-'));
  const dbPath = join(dir, 'orders.db');
  const code = `
    import assert from 'node:assert/strict';
    import { createHash, randomUUID } from 'node:crypto';
    process.env.CMS_DATABASE_URL = ${JSON.stringify(`file:${dbPath}`)};
    process.env.CMS_DATABASE_AUTH_TOKEN = '';
    process.env.CMS_ENV_GUARD = 'report';
    process.env.VERCEL = '';
    process.env.VERCEL_ENV = '';
    process.env.PAYMENT_PROVIDER = 'sadad';
    process.env.SADAD_SECRET_KEY = 'test-secret-key-not-real';
    process.env.SADAD_MERCHANT_ID = 'test-merchant';
    process.env.SADAD_PUBLIC_ORIGIN = 'https://example.test';

    const { db, initDb } = await import('./src/cms/db.ts');
    const { initOrders, customerOrder, hash } = await import('./src/ordering/checkout/repository.ts');
    const { paymentFailNoticeKind, PAYMENT_FAIL_RETRY_LIMIT } = await import('./src/ordering/payment-fail-notice.ts');
    const { POST: callbackPost } = await import('./src/app/api/payments/callback/route.ts');
    const { POST: webhookPost } = await import('./src/app/api/payments/webhook/route.ts');

    await initDb();
    await initOrders();
    await db.execute({ sql: 'PRAGMA foreign_keys=ON' });

    const session = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
    const orderId = \`SU-\${randomUUID()}\`;
    const now = new Date().toISOString();
    await db.execute({
      sql: \`INSERT INTO orders (id, branch_id, status, payment_method, total_minor, currency, session_hash, idempotency_key, request_hash, snapshot, created_at, updated_at, order_number)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)\`,
      args: [
        orderId, 'west-bay', 'placed', 'sadad', 2500, 'QAR', hash(session),
        'idem-' + randomUUID(), 'req',
        JSON.stringify({ branchId: 'west-bay', customer: { name: 'T', phone: '97455551234', brand: 'toyota', plate: 'Q123', colour: '', car: '', instructions: '' }, lines: [], totalMinor: 2500, currency: 'QAR' }),
        now, now, 1,
      ],
    });

    const cb = await callbackPost(new Request('https://example.test/api/payments/callback', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: \`ORDERID=\${encodeURIComponent(orderId)}&checksumhash=deadbeef&transaction_status=2&TXNAMOUNT=25.00&nonce=1\`,
    }));
    assert.equal(cb.status, 200);

    const wh = await webhookPost(new Request('https://example.test/api/payments/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.50' },
      body: JSON.stringify({
        websiteRefNo: orderId,
        checksumhash: 'cafebabe',
        transactionStatus: '2',
        txnAmount: '25.00',
        nonce: '2',
      }),
    }));
    assert.equal(wh.status, 400);

    const events = await db.execute({
      sql: \`SELECT COUNT(*) AS n FROM payment_events
            WHERE order_id=? AND kind IN ('callback','webhook') AND our_status='failed'\`,
      args: [orderId],
    });
    assert.equal(Number(events.rows[0].n), 0, 'verify-failed must not insert countable payment_events');

    const receipt = await customerOrder(orderId, session);
    assert.equal(receipt.failedPaymentCount, 0);
    assert.equal(paymentFailNoticeKind(receipt.failedPaymentCount), 'retry');
    assert.ok(receipt.failedPaymentCount < PAYMENT_FAIL_RETRY_LIMIT);

    const verifyFailedKeys = await db.execute({
      sql: \`SELECT COUNT(*) AS n FROM payment_events WHERE order_id=? AND event_key LIKE '%verify-failed%'\`,
      args: [orderId],
    });
    assert.equal(Number(verifyFailedKeys.rows[0].n), 0);

    db.close();
  `;
  const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', code], {
    encoding: 'utf8',
    timeout: 30000,
    cwd: process.cwd(),
    env: {
      ...process.env,
      CMS_DATABASE_AUTH_TOKEN: '',
      CMS_PUBLIC_MENU_SOURCE_URL: '',
      CMS_ENV_GUARD: 'report',
    },
  });
  rmSync(dir, { recursive: true, force: true });
  assert.equal(result.status, 0, result.stderr || result.stdout || String(result.error));
});
