import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('coupon preview quotes a code for the session and does not claim it', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sn-coupon-preview-'));
  const result = spawnSync(process.execPath, ['--experimental-test-module-mocks', '--import', 'tsx', '--eval', `
    const assert = (await import('node:assert/strict')).default;
    const { mock } = await import('node:test');
    delete process.env.CMS_PUBLIC_MENU_SOURCE_URL;
    const session = 'ab'.repeat(32);
    let token = session;
    mock.module('next/headers', { namedExports: { cookies: async () => ({
      get: (name) => name === 'sushinaa-order-session' && token ? { value: token } : undefined,
      set() {},
    }) } });
    const coupons = await import('./src/ordering/coupons/repository.ts');
    const route = await import('./src/app/api/orders/coupon-preview/route.ts');
    const { db } = await import('./src/cms/db.ts');
    await coupons.createCoupon({ code: 'SAVE10', kind: 'percent', value: 10, expiresAt: '2027-06-01T00:00:00.000Z' });
    const headers = { origin: 'http://localhost', host: 'localhost', 'content-type': 'application/json' };
    const post = (body) => route.POST(new Request('http://localhost/api/orders/coupon-preview', {
      method: 'POST', headers, body: JSON.stringify(body),
    }));
    const ok = await post({ code: ' save-10 ', subtotalMinor: 1000 });
    assert.equal(ok.status, 200);
    assert.deepEqual(await ok.json(), { code: 'SAVE10', discountMinor: 100, totalMinor: 900 });
    const status = async () => (await db.execute({ sql: "SELECT status FROM coupons WHERE code='SAVE10'" })).rows[0].status;
    assert.equal(await status(), 'available');
    const again = await post({ code: 'SAVE10', subtotalMinor: 1000 });
    assert.equal(again.status, 200);
    assert.equal(await status(), 'available');
    const missing = await post({ code: 'NOPE00', subtotalMinor: 1000 });
    assert.equal(missing.status, 409);
    assert.deepEqual(await missing.json(), { code: 'NOT_FOUND' });
    const free = await post({ code: 'SAVE10', subtotalMinor: 0 });
    assert.equal(free.status, 409);
    assert.deepEqual(await free.json(), { code: 'NON_POSITIVE' });
    assert.equal(await status(), 'available');
    token = '';
    const denied = await post({ code: 'SAVE10', subtotalMinor: 1000 });
    assert.equal(denied.status, 401);
    assert.deepEqual(await denied.json(), { code: 'SESSION_REQUIRED' });
    db.close();
  `], {
    encoding: 'utf8',
    timeout: 20000,
    env: {
      ...process.env,
      CMS_DATABASE_URL: `file:${dir}/coupons.db`,
      CMS_DATABASE_AUTH_TOKEN: '',
      VERCEL: '',
      VERCEL_ENV: 'preview',
      CMS_ENV_GUARD: 'report',
    },
  });
  rmSync(dir, { recursive: true, force: true });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
