import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { BRANCHES as branches } from '../src/branches/branches';
import { branchStatus, qatarClock } from '../src/branches/hours';
import { CheckoutError, checkoutSchema, customerSchema, quoteOrder, validCheckoutSelection, type CheckoutInput } from '../src/ordering/checkout/validation';
import { defaultSelection, serializeSelection, parseSelection, isSelectionComplete, unitPrice } from '../src/ordering/price';
import { menuSchema, publicMenu } from '../src/cms/schema';
const menu = menuSchema.parse(JSON.parse(readFileSync('data/initial-menu.json', 'utf8')));
const at = (date: string) => new Date(`${date}+03:00`);
const open = (id: string, date: string) => branchStatus(branches.find(b => b.slug === id)!.hours, qatarClock(at(date))).open;
test('Qatar branch boundaries include opening and exclude closing, including Thursday into Friday', () => {
  assert.equal(open('down-town', '2026-10-22T11:59:59'), false);
  assert.equal(open('down-town', '2026-10-22T12:00:00'), true);
  assert.equal(open('down-town', '2026-10-23T02:29:59'), true);
  assert.equal(open('down-town', '2026-10-23T02:30:00'), false);
  assert.equal(open('down-town', '2026-10-23T12:59:59'), false);
  assert.equal(open('down-town', '2026-10-23T13:00:00'), true);
  assert.equal(open('al-thumama', '2026-10-23T02:59:59'), true);
  assert.equal(open('al-thumama', '2026-10-23T03:00:00'), false);
  assert.equal(open('west-bay', '2026-10-22T13:59:59'), false);
  assert.equal(open('west-bay', '2026-10-22T14:00:00'), true);
  assert.equal(open('west-bay', '2026-10-22T23:00:00'), false);
  assert.equal(open('al-khor', '2026-10-22T00:01:00'), false);
  assert.equal(open('al-khor', '2026-10-23T00:29:59'), true);
  assert.equal(open('al-khor', '2026-10-23T00:30:00'), false);
  assert.equal(open('al-khor', '2026-10-25T00:15:00'), true);
  assert.equal(open('al-khor', '2026-10-25T22:30:00'), false);
  assert.equal(open('al-khor', '2026-10-26T00:15:00'), false);
});
test('every day and branch changes status at exactly its configured boundaries', () => {
  for (const b of branches) for (let day = 0; day < 7; day++) {
    const { open: start, close: end } = b.hours[day];
    const midnight = new Date(`2026-10-${18 + day}T00:00:00+03:00`).getTime();
    assert.equal(branchStatus(b.hours, qatarClock(new Date(midnight + start * 60000 - 1))).open, false, `${b.slug} ${day} before opening`);
    assert.equal(branchStatus(b.hours, qatarClock(new Date(midnight + start * 60000))).open, true);
    assert.equal(branchStatus(b.hours, qatarClock(new Date(midnight + end * 60000 - 1))).open, true);
    assert.equal(branchStatus(b.hours, qatarClock(new Date(midnight + end * 60000))).open, false);
  }
});
const customer = { name: 'علي O’Neil', phone: '+974 ٥٥٥٥ ١٢٣٤', brand: 'toyota', plate: 'q٠٠١٢٣', colour: '', car: '', instructions: '' };
test('normalises Arabic and Persian digits and requires a Q, T or R plate with 3–6 numbers', () => {
  const parsed = customerSchema.parse(customer);
  assert.equal(parsed.phone, '97455551234'); assert.equal(parsed.plate, 'Q00123');
  assert.equal(customerSchema.parse({ ...customer, phone: '۰۰۹۷۴۵۵۵۵۱۲۳۴' }).phone, '97455551234');
  for (const series of ['Q', 'T', 'R']) {
    assert.equal(customerSchema.parse({ ...customer, plate: `${series}123` }).plate, `${series}123`);
    assert.equal(customerSchema.parse({ ...customer, plate: `${series}123456` }).plate, `${series}123456`);
    assert.equal(customerSchema.safeParse({ ...customer, plate: `${series}12` }).success, false);
    assert.equal(customerSchema.safeParse({ ...customer, plate: `${series}1234567` }).success, false);
  }
  assert.equal(customerSchema.safeParse({ ...customer, phone: '111' }).success, false);
  assert.equal(customerSchema.safeParse({ ...customer, plate: '<script>' }).success, false);
  assert.equal(customerSchema.safeParse({ ...customer, plate: '123 A' }).success, false);
  assert.equal(customerSchema.safeParse({ ...customer, plate: '123-45' }).success, false);
  assert.equal(customerSchema.safeParse({ ...customer, plate: 'A123' }).success, false);
});
const roll = publicMenu(menu).dishes.find(d => d.kind.type === 'roll' && d.kind.proteins.some(p => p.prices[4] && p.prices[8]))!;
assert.equal(roll.kind.type, 'roll');
const protein = roll.kind.proteins.find(p => p.prices[4] && p.prices[8])!;
const selection = { ...defaultSelection(roll), protein: protein.id };
const input: CheckoutInput = checkoutSchema.parse({ branchId: 'down-town', customer, lines: [
  { dishId: roll.id, selection: { ...selection, pieces: 4 }, quantity: 1, note: 'No cucumber', expectedUnitMinor: protein.prices[4]! * 100 },
  { dishId: roll.id, selection: { ...selection, pieces: 8 }, quantity: 2, note: 'Sauce on the side', expectedUnitMinor: protein.prices[8]! * 100 },
] });
test('distinct servings retain notes, portions and server-calculated integer totals', async () => {
  const order = await quoteOrder(input, menu, at('2026-10-22T15:00:00'));
  assert.equal(order.lines.length, 2); assert.equal(order.lines[0].note, 'No cucumber');
  assert.equal(order.lines[1].selection.pieces, 8);
  assert.equal(order.totalMinor, protein.prices[4]! * 100 + 2 * protein.prices[8]! * 100);
});
test('rejects changed prices, hidden dishes, invalid choices, duplicate extras and closed branches', async () => {
  await assert.rejects(() => quoteOrder({ ...input, lines: [{ ...input.lines[0], expectedUnitMinor: 1 }] }, menu, at('2026-10-22T15:00:00')), /PRICE_CHANGED/);
  const hidden = structuredClone(menu); hidden.dishes.find(d => d.id === roll.id)!.available = false;
  await assert.rejects(() => quoteOrder(input, hidden, at('2026-10-22T15:00:00')), /UNAVAILABLE/);
  await assert.rejects(() => quoteOrder(input, menu, at('2026-10-23T03:00:00')), /CLOSED/);
  assert.equal(checkoutSchema.parse({ ...input, couponCode: ' save-10 ' }).couponCode, 'save-10');
  assert.equal(validCheckoutSelection(roll, { ...input.lines[0].selection, protein: 'invented' }), false);
  assert.equal(validCheckoutSelection(roll, { ...input.lines[0].selection, size: 'invented' }), false);
  assert.equal(checkoutSchema.safeParse({ ...input, totalMinor: 1 }).success, false);
  assert.equal(checkoutSchema.safeParse({ ...input, lines: [{ ...input.lines[0], selection: { ...selection, extras: ['x', 'x'] } }] }).success, false);
});
test('collection details strip a legacy email key — pickup UI does not collect it', () => {
  const withEmail = customerSchema.parse({ ...customer, email: 'guest@example.com' });
  assert.equal('email' in withEmail, false);
  assert.equal(customerSchema.parse({ ...customer, email: '' }).phone, '97455551234');
});

test('all complete menu selections remain valid after the real basket serialization round trip', async () => {
  for (const dish of publicMenu(menu).dishes) {
    const selection = parseSelection(serializeSelection(defaultSelection(dish)));
    if (!isSelectionComplete(dish, selection)) continue; // Boxes intentionally need customer choices.
    assert.equal(validCheckoutSelection(dish, selection), true, dish.id);
    const order = await quoteOrder({ ...input, lines: [{ dishId: dish.id, selection, quantity: 1, note: '', expectedUnitMinor: Math.round(unitPrice(dish, selection) * 100) }] }, menu, at('2026-10-22T15:00:00'));
    assert.equal(order.totalMinor, Math.round(unitPrice(dish, selection) * 100));
  }
});

const openAt = at('2026-10-22T15:00:00');
const couponExpiry = '2027-06-01T00:00:00.000Z';

describe('one-time coupons at checkout', { concurrency: false }, () => {
  let dir: string;
  let repository: typeof import('../src/ordering/checkout/repository');
  let coupons: typeof import('../src/ordering/coupons/repository');
  let orders: typeof import('../src/ordering/orders');
  let payments: typeof import('../src/ordering/payments');
  let db: (typeof import('../src/cms/db'))['db'];
  const ctx = { actor: 'test-staff', ip: null, userAgent: null };
  const admin = { kind: 'all' as const };

  before(async () => {
    dir = mkdtempSync(join(tmpdir(), 'sn-checkout-coupon-'));
    process.env.CMS_DATABASE_URL = `file:${dir}/orders.db`;
    process.env.CMS_DATABASE_AUTH_TOKEN = '';
    process.env.VERCEL = '';
    process.env.VERCEL_ENV = 'preview';
    process.env.PAYMENT_PROVIDER = 'mock';
    process.env.CMS_ENV_GUARD = 'report';
    delete process.env.CMS_PUBLIC_MENU_SOURCE_URL;
    repository = await import('../src/ordering/checkout/repository');
    coupons = await import('../src/ordering/coupons/repository');
    orders = await import('../src/ordering/orders');
    payments = await import('../src/ordering/payments');
    ({ db } = await import('../src/cms/db'));
    await repository.initOrders();
  });
  after(() => { db.close(); rmSync(dir, { recursive: true, force: true }); });

  function coded(code: string) {
    return checkoutSchema.parse({ ...input, couponCode: code });
  }
  async function addAmount(code: string, value: number, expiresAt = couponExpiry) {
    return coupons.createCoupon({ code, kind: 'amount', value, expiresAt }, openAt);
  }
  async function couponOf(code: string) {
    const row = (await db.execute({
      sql: 'SELECT status, held_order_id, redeemed_order_id FROM coupons WHERE code=?',
      args: [code],
    })).rows[0];
    assert.ok(row);
    return row;
  }
  async function place(code: string, method: 'mock' | 'pay_at_pickup' = 'mock') {
    const body = coded(code);
    const snapshot = await quoteOrder(body, menu, openAt);
    const session = randomUUID();
    const key = randomUUID();
    const requestHash = repository.checkoutRequestHash(body, method);
    const order = await repository.persistPendingOrder(session, key, requestHash, snapshot, 1, method);
    return { body, snapshot, session, key, requestHash, order };
  }

  test('a coupon lowers the payable total, keeps menu prices, and holds the code', async () => {
    const full = await quoteOrder(input, menu, openAt);
    assert.ok(full.totalMinor > 100);
    await addAmount('TENQAR', 100);
    const quoted = await quoteOrder(coded('ten-qar'), menu, openAt);
    assert.equal(quoted.coupon?.code, 'TENQAR');
    assert.equal(quoted.totalMinor, full.totalMinor - 100);
    assert.equal(quoted.lines.reduce((sum, line) => sum + line.totalMinor, 0), full.totalMinor);
    assert.equal((await couponOf('TENQAR')).status, 'available');
    const placed = await place('TENQAR');
    assert.equal(placed.order.totalMinor, full.totalMinor - 100);
    const stored = (await db.execute({ sql: 'SELECT snapshot, total_minor FROM orders WHERE id=?', args: [placed.order.id] })).rows[0];
    const snapshot = JSON.parse(String(stored.snapshot));
    assert.equal(Number(stored.total_minor), full.totalMinor - 100);
    assert.deepEqual(snapshot.coupon, { code: 'TENQAR', kind: 'amount', value: 100, discountMinor: 100 });
    assert.equal(snapshot.lines.reduce((sum: number, line: { totalMinor: number }) => sum + line.totalMinor, 0), full.totalMinor);
    const receipt = await repository.customerOrder(placed.order.id, placed.session);
    assert.equal(receipt.details.discountMinor, 100);
    assert.equal(receipt.totalMinor, full.totalMinor - 100);
    assert.equal((await couponOf('TENQAR')).status, 'held');
    assert.equal((await couponOf('TENQAR')).held_order_id, placed.order.id);
  });

  test('replaying the same checkout does not claim again, and another code is a different request', async () => {
    await addAmount('SAMECODE', 100);
    await addAmount('OTHERCODE', 100);
    const first = await place('SAMECODE');
    const again = await repository.persistPendingOrder(first.session, first.key, first.requestHash, first.snapshot, 1, 'mock');
    assert.equal(again.reused, true);
    assert.equal(again.id, first.order.id);
    assert.equal((await couponOf('SAMECODE')).held_order_id, first.order.id);
    const other = coded('OTHERCODE');
    const otherSnapshot = await quoteOrder(other, menu, openAt);
    await assert.rejects(
      repository.persistPendingOrder(first.session, first.key, repository.checkoutRequestHash(other, 'mock'), otherSnapshot, 1, 'mock'),
      (error: unknown) => error instanceof CheckoutError && error.code === 'CONFLICT',
    );
    assert.equal((await couponOf('SAMECODE')).held_order_id, first.order.id);
    assert.equal((await couponOf('OTHERCODE')).status, 'available');
    const rows = await db.execute({ sql: 'SELECT id FROM orders WHERE session_hash=?', args: [repository.hash(first.session)] });
    assert.equal(rows.rows.length, 1);
  });

  test('a second checkout cannot hold the same code', async () => {
    await addAmount('RACE100', 100);
    const body = coded('RACE100');
    const snapshot = await quoteOrder(body, menu, openAt);
    const attempts = [randomUUID(), randomUUID()].map((session) => ({ session, key: randomUUID() }));
    const results = await Promise.allSettled(attempts.map((attempt) => repository.persistPendingOrder(
      attempt.session, attempt.key, repository.checkoutRequestHash(body, 'mock'), snapshot, 1, 'mock',
    )));
    const won = results.filter((result) => result.status === 'fulfilled');
    const lost = results.filter((result) => result.status === 'rejected');
    assert.equal(won.length, 1);
    assert.equal(lost.length, 1);
    const reason = lost[0].status === 'rejected' ? lost[0].reason : undefined;
    assert.ok(reason instanceof CheckoutError && reason.code === 'UNAVAILABLE');
    const winner = won[0].status === 'fulfilled' ? won[0].value : undefined;
    assert.equal((await couponOf('RACE100')).held_order_id, winner?.id);
    for (let index = 0; index < results.length; index += 1) {
      if (results[index].status !== 'rejected') continue;
      const rows = await db.execute({ sql: 'SELECT id FROM orders WHERE session_hash=?', args: [repository.hash(attempts[index].session)] });
      assert.equal(rows.rows.length, 0);
    }
  });

  test('settlement burns a held coupon and pay-at-pickup burns it when the counter records payment', async () => {
    await addAmount('ONLINE1', 100);
    const online = await place('ONLINE1', 'mock');
    const settled = await payments.settlePayment(online.order.id, payments.mockProvider.eventFor(online.order.id), {
      sessionHash: repository.hash(online.session), method: 'mock',
    }, openAt);
    assert.equal(settled, true);
    assert.equal((await couponOf('ONLINE1')).status, 'redeemed');
    assert.equal((await couponOf('ONLINE1')).redeemed_order_id, online.order.id);

    await addAmount('COUNTER1', 100);
    const counter = await place('COUNTER1', 'pay_at_pickup');
    for (const [expected, to] of [['placed', 'accepted'], ['accepted', 'preparing'], ['preparing', 'ready']] as const) {
      await orders.transitionOrder(admin, counter.order.id, { expected, to }, ctx);
    }
    assert.equal((await couponOf('COUNTER1')).status, 'held');
    const paidAt = new Date('2026-10-23T16:00:00Z');
    await orders.transitionOrder(admin, counter.order.id, { expected: 'ready', to: 'completed', recordPayment: true }, ctx, paidAt);
    assert.equal((await couponOf('COUNTER1')).status, 'redeemed');
    assert.equal((await couponOf('COUNTER1')).redeemed_order_id, counter.order.id);
    assert.equal(String((await db.execute({ sql: 'SELECT paid_at FROM orders WHERE id=?', args: [counter.order.id] })).rows[0].paid_at), paidAt.toISOString());
  });

  test('cancelling the order releases the hold', async () => {
    await addAmount('CANCEL1', 100);
    const placed = await place('CANCEL1', 'pay_at_pickup');
    await orders.transitionOrder(admin, placed.order.id, { expected: 'placed', to: 'cancelled', reason: 'customer_request' }, ctx, openAt);
    const coupon = await couponOf('CANCEL1');
    assert.equal(coupon.status, 'available');
    assert.equal(coupon.held_order_id, null);
  });

  test('the 30-minute payment label does not release the hold, and a later settlement still burns it', async () => {
    await addAmount('LATEPAY', 100);
    const placed = await place('LATEPAY', 'mock');
    const stale = new Date(Date.now() - 31 * 60 * 1000).toISOString();
    await db.execute({ sql: 'UPDATE orders SET created_at=? WHERE id=?', args: [stale, placed.order.id] });
    const viewed = await repository.customerOrder(placed.order.id, placed.session);
    assert.equal(viewed.paymentStatus, 'expired');
    assert.equal((await couponOf('LATEPAY')).status, 'held');
    const settled = await payments.settlePayment(placed.order.id, payments.mockProvider.eventFor(placed.order.id), {
      sessionHash: repository.hash(placed.session), method: 'mock',
    });
    assert.equal(settled, true);
    assert.equal((await couponOf('LATEPAY')).status, 'redeemed');
  });

  test('missing, expired, and zeroing codes fail the quote and stay unclaimed', async () => {
    await assert.rejects(quoteOrder(coded('MISSING1'), menu, openAt), (error: unknown) => error instanceof CheckoutError && error.code === 'NOT_FOUND');
    await assert.rejects(quoteOrder(coded('no'), menu, openAt), (error: unknown) => error instanceof CheckoutError && error.code === 'INVALID_CODE');
    await addAmount('GONE', 100, openAt.toISOString());
    await assert.rejects(quoteOrder(coded('GONE'), menu, openAt), (error: unknown) => error instanceof CheckoutError && error.code === 'EXPIRED');
    assert.equal((await couponOf('GONE')).status, 'available');
    const full = await quoteOrder(input, menu, openAt);
    await addAmount('ZEROED', full.totalMinor);
    await assert.rejects(quoteOrder(coded('ZEROED'), menu, openAt), (error: unknown) => error instanceof CheckoutError && error.code === 'NON_POSITIVE');
    assert.equal((await couponOf('ZEROED')).status, 'available');
  });
});
