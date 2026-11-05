import { test, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LIVE_DATABASE_HOST } from '../src/lib/deploy-env';
import { validateManualCode } from '../src/ordering/coupons/code';
import type { Coupon } from '../src/ordering/coupons/types';

if (process.env.ADMIN_COUPONS_MOCKS !== '1') {
  test('admin coupon http', () => {
    const env = { ...process.env, ADMIN_COUPONS_MOCKS: '1' };
    for (const key of Object.keys(env)) {
      if (key === 'NODE_CHANNEL_FD' || key.startsWith('NODE_TEST_')) delete env[key];
    }
    const result = spawnSync(process.execPath, [
      '--experimental-test-module-mocks',
      '--import', 'tsx',
      '--test-concurrency=1',
      '--test',
      'tests/admin-coupons.test.ts',
    ], {
      encoding: 'utf8',
      timeout: 60_000,
      env,
    });
    const output = `${result.stdout}\n${result.stderr}`;
    assert.equal(result.status, 0, output);
    assert.match(output, /ℹ tests 5/);
    assert.match(output, /ℹ pass 5/);
  });
} else {

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const ADMIN = 'admin-token';
const BRANCH = 'branch-token';
const LATER = '2027-06-01T12:00:00.000Z';
const dir = mkdtempSync(join(tmpdir(), 'sn-admin-coupons-'));

process.env.CMS_DATABASE_URL = `file:${dir}/coupons.db`;
process.env.CMS_DATABASE_AUTH_TOKEN = '';
process.env.VERCEL = '';
process.env.VERCEL_ENV = 'preview';
process.env.CMS_ENV_GUARD = 'report';
delete process.env.CMS_PUBLIC_MENU_SOURCE_URL;

let session: string | undefined = ADMIN;

mock.module('next/headers', {
  exports: {
    cookies: async () => ({
      get: () => (session === undefined ? undefined : { value: session }),
      set: () => undefined,
    }),
  },
});

function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

let listRoute: typeof import('../src/app/api/admin/coupons/route');
let disableRoute: typeof import('../src/app/api/admin/coupons/[id]/route');
let db: (typeof import('../src/cms/db'))['db'];
let coupons: typeof import('../src/ordering/coupons/repository');

function post(url: string, body: unknown) {
  return new Request(url, {
    method: 'POST',
    headers: {
      origin: 'http://localhost',
      host: 'localhost',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

async function insertStaff(id: string, username: string, role: string, token: string) {
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO staff_users (id,username,password_hash,role,branch_id,auth_version,disabled_at,created_at,updated_at)
      VALUES (?,?,?,?,?,1,NULL,?,?)`,
    args: [id, username, 'x', role, role === 'admin' ? null : 'down-town', now, now],
  });
  await db.execute({
    sql: `INSERT INTO staff_sessions (token_hash,user_id,auth_version,expires,created_at) VALUES (?,?,?,?,?)`,
    args: [tokenHash(token), id, 1, Date.now() + 60_000, now],
  });
}

before(async () => {
  const { initDb } = await import('../src/cms/db');
  ({ db } = await import('../src/cms/db'));
  await initDb();
  await insertStaff('US-admin', 'coupon-admin', 'admin', ADMIN);
  await insertStaff('US-branch', 'coupon-branch', 'branch_staff', BRANCH);
  listRoute = await import('../src/app/api/admin/coupons/route');
  disableRoute = await import('../src/app/api/admin/coupons/[id]/route');
  coupons = await import('../src/ordering/coupons/repository');
});

after(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

test('an admin can generate a code, create percent and amount coupons, and list them', async () => {
  session = ADMIN;
  const beforeList = await listRoute.GET();
  assert.equal(beforeList.status, 200);
  const beforeRows = await beforeList.json() as Coupon[];

  const generated = await listRoute.POST(post('http://localhost/api/admin/coupons', { generate: true }));
  assert.equal(generated.status, 200);
  const { code } = await generated.json() as { code: string };
  assert.equal(code.length, 9);
  assert.equal(code[4], '-');
  const body = code.replace('-', '');
  assert.equal(body.length, 8);
  for (const char of body) assert.ok(ALPHABET.includes(char), char);
  assert.equal(validateManualCode(code), body);

  const untouched = await listRoute.GET();
  assert.equal((await untouched.json() as Coupon[]).length, beforeRows.length);

  const percent = await listRoute.POST(post('http://localhost/api/admin/coupons', {
    code, kind: 'percent', value: '15', expiresAt: LATER,
  }));
  assert.equal(percent.status, 201);
  const percentRow = await percent.json() as Coupon;
  assert.equal(percentRow.code, body);
  assert.equal(percentRow.kind, 'percent');
  assert.equal(percentRow.value, 15);
  assert.equal(percentRow.status, 'available');
  assert.equal(percentRow.redeemedOrderId, null);
  assert.equal(percentRow.expiresAt, LATER);

  const amount = await listRoute.POST(post('http://localhost/api/admin/coupons', {
    code: 'save-10', kind: 'amount', value: '12.50', expiresAt: '2027-06-01T15:00:00+03:00',
  }));
  assert.equal(amount.status, 201);
  const amountRow = await amount.json() as Coupon;
  assert.equal(amountRow.code, 'SAVE10');
  assert.equal(amountRow.kind, 'amount');
  assert.equal(amountRow.value, 1250);
  assert.equal(amountRow.expiresAt, LATER);

  const odd = await listRoute.POST(post('http://localhost/api/admin/coupons', {
    code: 'half-qar', kind: 'amount', value: '0.5', expiresAt: LATER,
  }));
  assert.equal(odd.status, 201);
  assert.equal((await odd.json() as Coupon).value, 50);

  const listed = await listRoute.GET();
  const rows = await listed.json() as Coupon[];
  assert.ok(rows.some((row) => row.id === percentRow.id && row.code === body && row.value === 15));
  assert.ok(rows.some((row) => row.id === amountRow.id && row.value === 1250 && row.redeemedOrderId === null));
});

test('create rejects bad values, duplicates, and unknown fields', async () => {
  session = ADMIN;
  const duplicate = await listRoute.POST(post('http://localhost/api/admin/coupons', {
    code: 'SAVE10', kind: 'percent', value: '10', expiresAt: LATER,
  }));
  assert.equal(duplicate.status, 409);
  assert.deepEqual(await duplicate.json(), { code: 'CONFLICT' });

  const percent = await listRoute.POST(post('http://localhost/api/admin/coupons', {
    code: 'too-big', kind: 'percent', value: '100', expiresAt: LATER,
  }));
  assert.equal(percent.status, 400);
  assert.deepEqual(await percent.json(), { code: 'INVALID_VALUE' });

  const zero = await listRoute.POST(post('http://localhost/api/admin/coupons', {
    code: 'freebie', kind: 'amount', value: '0.00', expiresAt: LATER,
  }));
  assert.equal(zero.status, 400);
  assert.deepEqual(await zero.json(), { code: 'INVALID_VALUE' });

  const extra = await listRoute.POST(post('http://localhost/api/admin/coupons', {
    code: 'plain', kind: 'percent', value: '10', expiresAt: LATER, note: 'no',
  }));
  assert.equal(extra.status, 400);
  assert.deepEqual(await extra.json(), { code: 'INVALID' });

  const both = await listRoute.POST(post('http://localhost/api/admin/coupons', {
    generate: true, code: 'plain2',
  }));
  assert.equal(both.status, 400);
  assert.deepEqual(await both.json(), { code: 'INVALID' });

  const expiry = await listRoute.POST(post('http://localhost/api/admin/coupons', {
    code: 'nodate', kind: 'percent', value: '10', expiresAt: 'tomorrow',
  }));
  assert.equal(expiry.status, 400);
  assert.deepEqual(await expiry.json(), { code: 'EXPIRES_REQUIRED' });
});

test('disable turns an available code off and leaves a held or missing code alone', async () => {
  session = ADMIN;
  const created = await listRoute.POST(post('http://localhost/api/admin/coupons', {
    code: 'once-off', kind: 'percent', value: '10', expiresAt: LATER,
  }));
  const row = await created.json() as Coupon;
  const disabled = await disableRoute.POST(
    post(`http://localhost/api/admin/coupons/${row.id}`, {}),
    { params: Promise.resolve({ id: row.id }) },
  );
  assert.equal(disabled.status, 200);
  assert.equal((await disabled.json() as Coupon).status, 'disabled');
  const again = await disableRoute.POST(
    post(`http://localhost/api/admin/coupons/${row.id}`, {}),
    { params: Promise.resolve({ id: row.id }) },
  );
  assert.equal(again.status, 200);
  assert.equal((await again.json() as Coupon).status, 'disabled');

  const held = await coupons.createCoupon({ code: 'held-one', kind: 'amount', value: 100, expiresAt: LATER });
  await coupons.claimCoupon(held.code, 'order-held', new Date('2026-11-05T12:00:00.000Z'));
  const blocked = await disableRoute.POST(
    post(`http://localhost/api/admin/coupons/${held.id}`, {}),
    { params: Promise.resolve({ id: held.id }) },
  );
  assert.equal(blocked.status, 409);
  assert.deepEqual(await blocked.json(), { code: 'CONFLICT' });

  await coupons.redeemCouponForOrder('order-held', new Date('2026-11-05T12:00:00.000Z'));
  const listed = await listRoute.GET();
  const redeemed = (await listed.json() as Coupon[]).find((item) => item.id === held.id);
  assert.equal(redeemed?.status, 'redeemed');
  assert.equal(redeemed?.redeemedOrderId, 'order-held');

  const missing = await disableRoute.POST(
    post('http://localhost/api/admin/coupons/missing', { reason: 'no' }),
    { params: Promise.resolve({ id: 'missing' }) },
  );
  assert.equal(missing.status, 400);
  assert.deepEqual(await missing.json(), { code: 'INVALID' });

  const absent = await disableRoute.POST(
    post('http://localhost/api/admin/coupons/missing', {}),
    { params: Promise.resolve({ id: 'missing' }) },
  );
  assert.equal(absent.status, 404);
  assert.deepEqual(await absent.json(), { code: 'NOT_FOUND' });
});

test('coupon routes require an admin session', async () => {
  session = undefined;
  const anonymous = await listRoute.GET();
  assert.equal(anonymous.status, 401);
  assert.deepEqual(await anonymous.json(), { code: 'UNAUTHENTICATED' });

  session = BRANCH;
  const denied = await listRoute.POST(post('http://localhost/api/admin/coupons', { generate: true }));
  assert.equal(denied.status, 403);
  assert.deepEqual(await denied.json(), { code: 'FORBIDDEN' });

  session = ADMIN;
  const bare = await listRoute.POST(new Request('http://localhost/api/admin/coupons', {
    method: 'POST',
    headers: { origin: 'http://localhost', host: 'localhost' },
    body: JSON.stringify({ generate: true }),
  }));
  assert.equal(bare.status, 415);
});

test('coupon routes refuse the live database host', () => {
  const result = spawnSync(process.execPath, ['--import', 'tsx', '--eval', `(async () => {
    const assert = (await import('node:assert/strict')).default;
    const list = await import('./src/app/api/admin/coupons/route.ts');
    const one = await import('./src/app/api/admin/coupons/[id]/route.ts');
    const listed = await list.GET();
    const created = await list.POST(new Request('http://localhost/api/admin/coupons', {
      method: 'POST',
      headers: { origin: 'http://localhost', host: 'localhost', 'content-type': 'application/json' },
      body: JSON.stringify({ generate: true }),
    }));
    const disabled = await one.POST(new Request('http://localhost/api/admin/coupons/x', {
      method: 'POST',
      headers: { origin: 'http://localhost', host: 'localhost', 'content-type': 'application/json' },
      body: '{}',
    }), { params: Promise.resolve({ id: 'x' }) });
    for (const response of [listed, created, disabled]) {
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), { code: 'ORDERING_UNAVAILABLE' });
    }
  })().catch((error) => { console.error(error); process.exit(1); })`], {
    encoding: 'utf8',
    timeout: 20000,
    env: {
      ...process.env,
      VERCEL: '1',
      VERCEL_ENV: 'preview',
      CMS_DATABASE_AUTH_TOKEN: '',
      CMS_ENV_GUARD: 'report',
      CMS_DATABASE_URL: `libsql://${LIVE_DATABASE_HOST}`,
    },
  });
  assert.equal(result.status, 0, result.stderr || String(result.error));
});

}
