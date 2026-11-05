import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateCode, normalizeCode, validateManualCode } from '../src/ordering/coupons/code';
import { applyOrderDiscount } from '../src/ordering/coupons/discount';
import { CouponError } from '../src/ordering/coupons/types';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const LATER = '2026-12-01T00:00:00.000Z';
const NOW = new Date('2026-11-05T12:00:00.000Z');

let dir: string;
let coupons: typeof import('../src/ordering/coupons/repository');
let db: (typeof import('../src/cms/db'))['db'];

function codeOf(error: unknown) {
  assert.ok(error instanceof CouponError);
  return error.code;
}

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'sn-coupons-'));
  process.env.CMS_DATABASE_URL = `file:${dir}/coupons.db`;
  process.env.CMS_DATABASE_AUTH_TOKEN = '';
  process.env.VERCEL = '';
  process.env.VERCEL_ENV = 'preview';
  process.env.CMS_ENV_GUARD = 'report';
  delete process.env.CMS_PUBLIC_MENU_SOURCE_URL;
  coupons = await import('../src/ordering/coupons/repository');
  ({ db } = await import('../src/cms/db'));
});

after(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

test('normalize strips spaces and hyphens and uppercases', () => {
  assert.equal(normalizeCode(' ab cd '), 'ABCD');
  assert.equal(normalizeCode('ab-cd'), 'ABCD');
  assert.equal(normalizeCode('xxxx-xxxx'), 'XXXXXXXX');
  assert.equal(validateManualCode('  welcome-10 '), 'WELCOME10');
  assert.equal(validateManualCode('o0il'), 'O0IL');
  assert.throws(() => validateManualCode('hi'), (error) => codeOf(error) === 'INVALID_CODE');
  assert.throws(() => validateManualCode('bad code!'), (error) => codeOf(error) === 'INVALID_CODE');
  assert.throws(() => validateManualCode('A'.repeat(17)), (error) => codeOf(error) === 'INVALID_CODE');
  assert.equal(validateManualCode('A'.repeat(16)), 'A'.repeat(16));
});

test('generateCode is 8 unambiguous characters shown as XXXX-XXXX', () => {
  for (let n = 0; n < 200; n++) {
    const display = generateCode();
    assert.equal(display.length, 9);
    assert.equal(display[4], '-');
    const body = normalizeCode(display);
    assert.equal(body.length, 8);
    for (const char of body) assert.ok(ALPHABET.includes(char), char);
  }
});

test('percent and amount discounts leave a positive payable total', () => {
  assert.deepEqual(applyOrderDiscount(1000, { kind: 'percent', value: 10 }), { discountMinor: 100, totalMinor: 900 });
  assert.deepEqual(applyOrderDiscount(150, { kind: 'percent', value: 1 }), { discountMinor: 2, totalMinor: 148 });
  assert.deepEqual(applyOrderDiscount(100, { kind: 'percent', value: 99 }), { discountMinor: 99, totalMinor: 1 });
  assert.deepEqual(applyOrderDiscount(1000, { kind: 'amount', value: 250 }), { discountMinor: 250, totalMinor: 750 });
  assert.deepEqual(applyOrderDiscount(1000, { kind: 'amount', value: 999 }), { discountMinor: 999, totalMinor: 1 });
  assert.throws(() => applyOrderDiscount(50, { kind: 'percent', value: 99 }), (error) => codeOf(error) === 'NON_POSITIVE');
  assert.throws(() => applyOrderDiscount(1000, { kind: 'amount', value: 1000 }), (error) => codeOf(error) === 'NON_POSITIVE');
  assert.throws(() => applyOrderDiscount(1000, { kind: 'amount', value: 1001 }), (error) => codeOf(error) === 'NON_POSITIVE');
  assert.throws(() => applyOrderDiscount(0, { kind: 'percent', value: 10 }), (error) => codeOf(error) === 'NON_POSITIVE');
  assert.throws(() => applyOrderDiscount(1000, { kind: 'percent', value: 100 }), (error) => codeOf(error) === 'INVALID_VALUE');
  assert.throws(() => applyOrderDiscount(1000, { kind: 'percent', value: 0 }), (error) => codeOf(error) === 'INVALID_VALUE');
  assert.throws(() => applyOrderDiscount(1000, { kind: 'amount', value: 0 }), (error) => codeOf(error) === 'INVALID_VALUE');
  assert.throws(() => applyOrderDiscount(10.5, { kind: 'amount', value: 1 }), (error) => codeOf(error) === 'INVALID_VALUE');
});

test('create stores a normalized code and rejects a missing expiry or a duplicate', async () => {
  const display = generateCode();
  const created = await coupons.createCoupon({
    code: display,
    kind: 'percent',
    value: 15,
    expiresAt: '2026-12-01T03:00:00+03:00',
  }, NOW);
  assert.equal(created.code, normalizeCode(display));
  assert.equal(created.status, 'available');
  assert.equal(created.expiresAt, LATER);
  assert.equal(created.kind, 'percent');
  assert.equal(created.value, 15);
  await assert.rejects(
    coupons.createCoupon({ code: display, kind: 'amount', value: 100, expiresAt: LATER }, NOW),
    (error) => codeOf(error) === 'CONFLICT',
  );
  await assert.rejects(
    coupons.createCoupon({ code: 'SAVE10', kind: 'percent', value: 10, expiresAt: '   ' }, NOW),
    (error) => codeOf(error) === 'EXPIRES_REQUIRED',
  );
  await assert.rejects(
    coupons.createCoupon({ code: 'SAVE10', kind: 'percent', value: 100, expiresAt: LATER }, NOW),
    (error) => codeOf(error) === 'INVALID_VALUE',
  );
  const listed = await coupons.listCoupons();
  assert.ok(listed.some((row) => row.code === created.code && row.status === 'available'));
});

test('a second claim loses, the same order can retry, and redeem then release stays burned', async () => {
  await coupons.createCoupon({ code: 'race-code', kind: 'amount', value: 100, expiresAt: LATER }, NOW);
  const [first, second] = await Promise.allSettled([
    coupons.claimCoupon('RACE-CODE', 'order-a', NOW),
    coupons.claimCoupon('race code', 'order-b', NOW),
  ]);
  const won = [first, second].filter((result) => result.status === 'fulfilled');
  const lost = [first, second].filter((result) => result.status === 'rejected');
  assert.equal(won.length, 1);
  assert.equal(lost.length, 1);
  assert.equal(codeOf(lost[0].status === 'rejected' ? lost[0].reason : undefined), 'UNAVAILABLE');
  const winnerId = won[0].status === 'fulfilled' ? won[0].value.heldOrderId : '';
  const retry = await coupons.claimCoupon('race-code', winnerId!, NOW);
  assert.equal(retry.status, 'held');
  assert.equal(retry.heldOrderId, winnerId);
  await assert.rejects(coupons.claimCoupon('race-code', 'order-c', NOW), (error) => codeOf(error) === 'UNAVAILABLE');

  const redeemed = await coupons.redeemCouponForOrder(winnerId!, NOW);
  assert.equal(redeemed.status, 'redeemed');
  assert.equal(redeemed.redeemedOrderId, winnerId);
  assert.equal(redeemed.heldOrderId, null);
  const redeemedAgain = await coupons.redeemCouponForOrder(winnerId!, NOW);
  assert.equal(redeemedAgain.status, 'redeemed');
  assert.equal(await coupons.releaseCouponForOrder(winnerId!, NOW), null);
  const still = (await coupons.listCoupons()).find((row) => row.code === 'RACECODE');
  assert.equal(still?.status, 'redeemed');
});

test('release returns a held code to available and a stale hold can be claimed', async () => {
  await coupons.createCoupon({ code: 'HOLDME', kind: 'amount', value: 100, expiresAt: LATER }, NOW);
  await coupons.claimCoupon('HOLDME', 'order-hold', NOW);
  const released = await coupons.releaseCouponForOrder('order-hold', NOW);
  assert.equal(released?.status, 'available');
  assert.equal(released?.heldOrderId, null);
  assert.equal(await coupons.releaseCouponForOrder('order-hold', NOW), null);
  const next = await coupons.claimCoupon('hold-me', 'order-next', NOW);
  assert.equal(next.heldOrderId, 'order-next');
  assert.equal(await coupons.releaseCouponForOrder('order-next', NOW) !== null, true);

  await coupons.claimCoupon('HOLDME', 'order-stale', NOW);
  const edge = new Date(NOW.getTime() + coupons.HOLD_TTL_MS);
  await assert.rejects(coupons.claimCoupon('HOLDME', 'order-other', edge), (error) => codeOf(error) === 'UNAVAILABLE');
  const after = new Date(NOW.getTime() + coupons.HOLD_TTL_MS + 1);
  const taken = await coupons.claimCoupon('HOLDME', 'order-other', after);
  assert.equal(taken.status, 'held');
  assert.equal(taken.heldOrderId, 'order-other');
  assert.equal(await coupons.releaseStaleHolds(new Date(after.getTime() + coupons.HOLD_TTL_MS + 1)), 1);
  const freed = (await coupons.listCoupons()).find((row) => row.code === 'HOLDME');
  assert.equal(freed?.status, 'available');
});

test('an order cannot hold two codes', async () => {
  await coupons.createCoupon({ code: 'ONECODE', kind: 'amount', value: 50, expiresAt: LATER }, NOW);
  await coupons.createCoupon({ code: 'TWOCODE', kind: 'amount', value: 50, expiresAt: LATER }, NOW);
  await coupons.claimCoupon('ONECODE', 'order-one', NOW);
  await assert.rejects(coupons.claimCoupon('TWOCODE', 'order-one', NOW), (error) => codeOf(error) === 'CONFLICT');
  const second = (await coupons.listCoupons()).find((row) => row.code === 'TWOCODE');
  assert.equal(second?.status, 'available');
});

test('expired, disabled, and held codes are not usable, and preview does not consume', async () => {
  const at = new Date('2026-11-05T18:00:00.000Z');
  await coupons.createCoupon({ code: 'EXPIRE1', kind: 'amount', value: 100, expiresAt: at.toISOString() }, at);
  await assert.rejects(coupons.claimCoupon('EXPIRE1', 'order-x', at), (error) => codeOf(error) === 'EXPIRED');
  await assert.rejects(coupons.loadUsableByCode('EXPIRE1', at), (error) => codeOf(error) === 'EXPIRED');

  await coupons.createCoupon({ code: 'LIVE10', kind: 'percent', value: 10, expiresAt: LATER }, NOW);
  const preview = await coupons.previewCoupon('live-10', 1000, NOW);
  assert.deepEqual(
    { discountMinor: preview.discountMinor, totalMinor: preview.totalMinor, snapshot: preview.snapshot },
    {
      discountMinor: 100,
      totalMinor: 900,
      snapshot: { code: 'LIVE10', kind: 'percent', value: 10, discountMinor: 100 },
    },
  );
  assert.equal(preview.coupon.status, 'available');

  await coupons.claimCoupon('LIVE10', 'order-live', NOW);
  await assert.rejects(coupons.previewCoupon('LIVE10', 1000, NOW), (error) => codeOf(error) === 'UNAVAILABLE');
  await coupons.releaseCouponForOrder('order-live', NOW);

  const disabled = await coupons.disableCoupon(preview.coupon.id, NOW);
  assert.equal(disabled.status, 'disabled');
  assert.ok(disabled.disabledAt);
  const disabledAgain = await coupons.disableCoupon(preview.coupon.id, NOW);
  assert.equal(disabledAgain.status, 'disabled');
  await assert.rejects(coupons.claimCoupon('LIVE10', 'order-late', NOW), (error) => codeOf(error) === 'UNAVAILABLE');
  await assert.rejects(coupons.loadUsableByCode('LIVE10', NOW), (error) => codeOf(error) === 'UNAVAILABLE');
  await assert.rejects(coupons.loadUsableByCode('MISSING', NOW), (error) => codeOf(error) === 'NOT_FOUND');
});

test('disable refuses a held code', async () => {
  const created = await coupons.createCoupon({ code: 'KEEPHELD', kind: 'amount', value: 100, expiresAt: LATER }, NOW);
  await coupons.claimCoupon('KEEPHELD', 'order-keep', NOW);
  await assert.rejects(coupons.disableCoupon(created.id, NOW), (error) => codeOf(error) === 'CONFLICT');
  const row = (await coupons.listCoupons()).find((item) => item.code === 'KEEPHELD');
  assert.equal(row?.status, 'held');
});
