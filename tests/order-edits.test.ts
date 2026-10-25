import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { menuSchema } from '../src/cms/schema';
import { defaultSelection, unitPrice } from '../src/ordering/price';
import { quoteOrder } from '../src/ordering/checkout/validation';
import { parseEditBody } from '../src/ordering/edits';

let repository: typeof import('../src/ordering/checkout/repository');
let orders: typeof import('../src/ordering/orders');
let edits: typeof import('../src/ordering/order-edits');
let printing: typeof import('../src/ordering/printing');
let db: (typeof import('../src/cms/db'))['db'];
let dir: string;
const ctx = { actor: 'test-staff', ip: null, userAgent: null };
const admin = { kind: 'all' as const };
const downTown = { kind: 'branch' as const, branchId: 'down-town' as const };
const otherBranch = { kind: 'branch' as const, branchId: 'al-khor' as const };
const menu = menuSchema.parse(JSON.parse(readFileSync('data/initial-menu.json', 'utf8')));
const dish = menu.dishes.find((item) => item.visible && item.available && item.kind.type === 'simple')!;
const added = menu.dishes.find((item) => item.visible && item.available && item.kind.type === 'simple' && item.id !== dish.id)!;
const at = new Date('2026-10-23T15:00:00+03:00');
const selection = defaultSelection(dish);
const unit = Math.round(unitPrice(dish, selection) * 100);
const snapshot = quoteOrder({
  branchId: 'down-town',
  customer: { name: 'Test customer', phone: '97455551234', plate: 'Q123456', colour: 'silver', car: 'test car', instructions: '' },
  lines: [{ dishId: dish.id, selection, quantity: 1, note: '', expectedUnitMinor: unit }],
}, menu, at);

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'sn-edit-suite-'));
  process.env.CMS_DATABASE_URL = `file:${dir}/orders.db`;
  process.env.CMS_DATABASE_AUTH_TOKEN = '';
  process.env.VERCEL = '';
  process.env.VERCEL_ENV = 'preview';
  process.env.PAYMENT_PROVIDER = 'mock';
  process.env.CMS_ENV_GUARD = 'report';
  delete process.env.CMS_PUBLIC_MENU_SOURCE_URL;
  repository = await import('../src/ordering/checkout/repository');
  orders = await import('../src/ordering/orders');
  edits = await import('../src/ordering/order-edits');
  printing = await import('../src/ordering/printing');
  ({ db } = await import('../src/cms/db'));
  await repository.initOrders();
  await db.execute({ sql: 'INSERT INTO menu (id, revision, content) VALUES (1, 1, ?)', args: [JSON.stringify(menu)] });
});
after(() => { db.close(); rmSync(dir, { recursive: true, force: true }); });

const rejected = async (promise: Promise<unknown>, code: string) => assert.rejects(promise, (error: unknown) => error instanceof Error && error.message === code);
const place = () => repository.persistPendingOrder(randomUUID(), randomUUID(), 'same', snapshot, 1, 'pay_at_pickup');
async function row(id: string) { return (await db.execute({ sql: 'SELECT * FROM orders WHERE id=?', args: [id] })).rows[0]; }
async function editsOf(id: string) { return (await db.execute({ sql: 'SELECT * FROM order_edits WHERE order_id=?', args: [id] })).rows; }

test('a client-sent total is ignored and the stored total equals the server math', async () => {
  const order = await place();
  const body = parseEditBody({ kind: 'qty', lineId: 'L0', quantity: 2, reasonCode: 'customer_request', total: 1, totalMinor: 1, price: 1 });
  assert.equal('totalMinor' in body, false);
  await edits.applyOrderEdit(admin, order.id, { ...body, totalMinor: 1, total: 5 }, ctx, 'admin');
  const stored = await row(order.id);
  assert.equal(Number(stored.total_minor), unit * 2);
  assert.equal(JSON.parse(String(stored.snapshot)).totalMinor, unit);
  assert.equal((await editsOf(order.id)).length, 1);
});

test('an oversized amount discount is rejected and the total stays unchanged', async () => {
  const order = await place();
  await rejected(edits.applyOrderEdit(admin, order.id, { kind: 'order_discount', mode: 'amount', amountMinor: unit + 1, reasonCode: 'goodwill' }, ctx, 'admin'), 'BELOW_ZERO');
  assert.equal(Number((await row(order.id)).total_minor), unit);
  assert.equal((await editsOf(order.id)).length, 0);
});

test('a paid increase is blocked and a paid decrease writes one unsettled adjustment', async () => {
  const order = await place();
  const paidAt = '2026-10-23T12:00:00.000Z';
  await db.execute({ sql: 'UPDATE orders SET paid_at=? WHERE id=?', args: [paidAt, order.id] });
  const eventsBefore = Number((await db.execute({ sql: 'SELECT COUNT(*) AS n FROM order_events WHERE order_id=?', args: [order.id] })).rows[0].n);
  await rejected(edits.applyOrderEdit(admin, order.id, {
    kind: 'add_item', dishId: added.id, selection: defaultSelection(added), quantity: 1, reasonCode: 'customer_request',
  }, ctx, 'admin'), 'INCREASE_ON_PAID_ORDER');
  assert.equal(Number((await db.execute({ sql: 'SELECT COUNT(*) AS n FROM order_adjustments WHERE order_id=?', args: [order.id] })).rows[0].n), 0);
  const eventsAfter = Number((await db.execute({ sql: 'SELECT COUNT(*) AS n FROM order_events WHERE order_id=?', args: [order.id] })).rows[0].n);
  assert.equal(eventsAfter, eventsBefore);
  await edits.applyOrderEdit(admin, order.id, { kind: 'line_price', lineId: 'L0', unitMinor: unit - 100, reasonCode: 'goodwill' }, ctx, 'admin');
  const adjustments = (await db.execute({ sql: 'SELECT amount_minor, settled_at FROM order_adjustments WHERE order_id=?', args: [order.id] })).rows;
  assert.equal(adjustments.length, 1);
  assert.equal(Number(adjustments[0].amount_minor), 100);
  assert.equal(adjustments[0].settled_at, null);
  assert.equal(Number((await db.execute({ sql: 'SELECT COUNT(*) AS n FROM order_events WHERE order_id=?', args: [order.id] })).rows[0].n), eventsBefore);
});

test('editing a completed order is rejected', async () => {
  const order = await place();
  await db.execute({ sql: "UPDATE orders SET status='completed', paid_at=? WHERE id=?", args: ['2026-10-23T12:00:00.000Z', order.id] });
  await rejected(edits.applyOrderEdit(admin, order.id, { kind: 'qty', lineId: 'L0', quantity: 2, reasonCode: 'staff_error' }, ctx, 'admin'), 'NOT_EDITABLE');
});

test('branch staff cannot compliment and cannot edit another branch', async () => {
  const order = await place();
  await rejected(edits.applyOrderEdit(downTown, order.id, { kind: 'compliment', lineId: 'L0', reasonCode: 'loyalty' }, ctx, 'branch_staff'), 'FORBIDDEN');
  await rejected(edits.applyOrderEdit(otherBranch, order.id, { kind: 'qty', lineId: 'L0', quantity: 2, reasonCode: 'other' }, ctx, 'branch_staff'), 'NOT_FOUND');
});

test('voiding the last line cancels the order and writes an audit row', async () => {
  const order = await place();
  const result = await edits.applyOrderEdit(admin, order.id, { kind: 'void', lineId: 'L0', reasonCode: 'item_unavailable' }, ctx, 'admin');
  assert.equal(result.cancelled, true);
  assert.equal(String((await row(order.id)).status), 'cancelled');
  const audit = (await db.execute({ sql: "SELECT action FROM audit WHERE entity_id=? AND action IN ('order.edited','order.status')", args: [order.id] })).rows.map((item) => String(item.action));
  assert.ok(audit.includes('order.edited'));
  assert.ok(audit.includes('order.status'));
});

test('a cancelled order cannot be reprinted and branch staff cannot refund', async () => {
  const order = await place();
  await db.execute({ sql: "UPDATE orders SET status='cancelled', printed_at=?, print_count=1 WHERE id=?", args: ['2026-10-23T12:00:00.000Z', order.id] });
  await rejected(printing.claimPrint(admin, order.id, 'reprint'), 'ALREADY_PRINTED');
  await rejected(orders.transitionOrder(admin, order.id, { expected: 'cancelled', to: 'refunded' }, ctx, new Date(), 'branch_staff'), 'FORBIDDEN');
});
