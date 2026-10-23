import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { ORDER_SCHEMA } from '../src/ordering/schema';
import { LIVE_DATABASE_HOST } from '../src/lib/deploy-env';

function run(code: string, env: Record<string, string>) {
  const result = spawnSync(process.execPath, ['--import', 'tsx', '--eval', code], {
    encoding: 'utf8', timeout: 15000,
    env: { ...process.env, CMS_DATABASE_AUTH_TOKEN: '', CMS_PUBLIC_MENU_SOURCE_URL: '', CMS_ENV_GUARD: 'report', ...env },
  });
  assert.equal(result.status, 0, result.stderr || String(result.error));
}
test('importing the order route with VERCEL=1 does not throw', () => {
  run("import('./src/app/api/orders/route.ts').then(() => console.log('imported'))", {
    VERCEL: '1', VERCEL_ENV: 'preview', CMS_DATABASE_URL: 'libsql://placeholder.invalid',
    ORDERING_PREVIEW_ENABLED: '',
  });
  run("import('./src/app/api/orders/route.ts').then(() => console.log('imported'))", {
    VERCEL: '1', VERCEL_ENV: 'preview', CMS_DATABASE_URL: '',
  });
});
test('ordering refuses to run or create tables on the live database host', () => {
  // No connection is made: initOrders must reject before constructing the lazy client.
  run(`(async () => {
    const assert = (await import('node:assert/strict')).default;
    globalThis.fetch = () => { throw new Error('network must not be touched'); };
    const repository = (await import('./src/ordering/checkout/repository.ts')).default;
    await assert.rejects(repository.initOrders(), /ORDERING_UNAVAILABLE/);
    const route = (await import('./src/app/api/orders/route.ts')).default;
    for (const response of [await route.GET(), await route.POST(new Request('http://localhost/api/orders', {method:'POST'}))]) {
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), {code:'ORDERING_UNAVAILABLE'});
    }
  })().catch(e => { console.error(e); process.exit(1); })`, {
    VERCEL: '1', VERCEL_ENV: 'preview', NODE_ENV: 'development', ORDERING_PREVIEW_ENABLED: 'true',
    CMS_DATABASE_URL: `libsql://${LIVE_DATABASE_HOST}`,
  });
});
test('order bootstrap and additive migration have identical SQL', () => {
  const sql = readFileSync('db/migrations/0002_orders.sql', 'utf8');
  assert.deepEqual(sql.split(';').map(s => s.trim()).filter(Boolean), ORDER_SCHEMA);
});
test('mock gateway cannot be enabled in production', () => {
  run(`(async () => {
    const assert = (await import('node:assert/strict')).default;
    const guard = (await import('./src/cms/env-guard.ts')).default;
    assert.throws(() => guard.assertPaymentProviderAllowed(), /Production must not use a mock/);
    const route = (await import('./src/app/api/orders/[id]/mock-pay/route.ts')).default;
    const response = await route.POST(new Request('http://localhost/api/orders/x/mock-pay', {method:'POST'}), {params:Promise.resolve({id:'x'})});
    assert.equal(response.status,404);
  })().catch(e => { console.error(e); process.exit(1); })`, {
    VERCEL_ENV: 'production', PAYMENT_PROVIDER: 'mock', CMS_DATABASE_URL: 'file:/tmp/unused-mock-guard.db',
  });
});
