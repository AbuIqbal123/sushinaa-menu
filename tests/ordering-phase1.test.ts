import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { menuSchema } from '../src/cms/schema';
import { orderQuery } from '../src/ordering/contracts';
import { checkoutSchema, quoteOrder, type OrderSnapshot } from '../src/ordering/checkout/validation';
import { defaultSelection, unitPrice } from '../src/ordering/price';
import { LIVE_DATABASE_HOST } from '../src/lib/deploy-env';
import { formatQar } from '../src/lib/money';
import type { listOrders, detailOrder, transitionOrder } from '../src/ordering/orders';
import type { claimPrint, confirmPrint } from '../src/ordering/printing';

type First<T> = T extends (...args: infer A) => unknown ? A[0] : never;
type TakesAll<T> = { kind: 'all' } extends First<T> ? true : false;
const branchPredicates: [
  TakesAll<typeof listOrders>,
  TakesAll<typeof detailOrder>,
  TakesAll<typeof transitionOrder>,
  TakesAll<typeof claimPrint>,
  TakesAll<typeof confirmPrint>,
] = [true, true, true, true, true];
void branchPredicates;

let repository: typeof import('../src/ordering/checkout/repository');
let orders: typeof import('../src/ordering/orders');
let printing: typeof import('../src/ordering/printing');
let payments: typeof import('../src/ordering/payments');
let staff: typeof import('../src/cms/staff');
let auth: typeof import('../src/cms/auth');
let passwords: typeof import('../src/cms/passwords');
let ticketModel: typeof import('../src/ordering/ticket').ticketModel;
let db: (typeof import('../src/cms/db'))['db'];
let dir: string;
const ctx = { actor: 'test-staff', ip: null, userAgent: null };
const admin = { kind: 'all' as const };
const downTown = { kind: 'branch' as const, branchId: 'down-town' as const };
const menu = menuSchema.parse(JSON.parse(readFileSync('data/initial-menu.json', 'utf8')));
const when = new Date('2026-10-23T15:00:00+03:00');
const dish = menu.dishes.find((item) => item.visible && item.available && item.kind.type === 'simple')!;
const quoteInput = checkoutSchema.parse({
  branchId: 'down-town',
  customer: { name: 'Test customer', phone: '97455551234', plate: 'Q123456', colour: 'silver', car: 'test car', instructions: 'gate note' },
  lines: [{ dishId: dish.id, selection: defaultSelection(dish), quantity: 1, note: 'line note', expectedUnitMinor: Math.round(unitPrice(dish, defaultSelection(dish)) * 100) }],
});
const snapshot: OrderSnapshot = quoteOrder(quoteInput, menu, when);

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'sn-phase1-'));
  process.env.CMS_DATABASE_URL = `file:${dir}/orders.db`;
  process.env.CMS_DATABASE_AUTH_TOKEN = '';
  process.env.VERCEL = '';
  process.env.VERCEL_ENV = 'preview';
  process.env.PAYMENT_PROVIDER = 'mock';
  process.env.CMS_ENV_GUARD = 'report';
  process.env.CRON_SECRET = 'phase1-test-secret';
  repository = await import('../src/ordering/checkout/repository');
  orders = await import('../src/ordering/orders');
  printing = await import('../src/ordering/printing');
  payments = await import('../src/ordering/payments');
  staff = await import('../src/cms/staff');
  auth = await import('../src/cms/auth');
  passwords = await import('../src/cms/passwords');
  ({ ticketModel } = await import('../src/ordering/ticket'));
  ({ db } = await import('../src/cms/db'));
  await repository.initOrders();
});
after(() => { db.close(); rmSync(dir, { recursive: true, force: true }); });

const rejected = async (promise: Promise<unknown>, code: string) => assert.rejects(promise, (error: unknown) => error instanceof Error && error.message === code);
async function row(id: string) { return (await db.execute({ sql: 'SELECT * FROM orders WHERE id=?', args: [id] })).rows[0]; }
async function audits(id: string, action?: string) {
  const sql = action
    ? 'SELECT * FROM audit WHERE entity_id=? AND action=? ORDER BY id'
    : 'SELECT * FROM audit WHERE entity_id=? ORDER BY id';
  return (await db.execute({ sql, args: action ? [id, action] : [id] })).rows;
}
const place = (branchId: 'down-town' | 'west-bay' = 'down-town', method: 'mock' | 'pay_at_pickup' = 'pay_at_pickup') =>
  repository.persistPendingOrder(randomUUID(), randomUUID(), randomUUID(), { ...snapshot, branchId }, 1, method);
const adminActor = { userId: 'US-admin', username: 'env-admin', role: 'admin' as const, branchScope: admin };

function changedOrderColumns(before: Record<string, unknown>, after: Record<string, unknown>) {
  return Object.keys(after).filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key])).sort();
}

describe('ordering phase 1', { concurrency: false }, () => {
test('mock payment does not change created_at or any non-payment order field', async () => {
  const session = randomUUID();
  const order = await repository.persistPendingOrder(session, randomUUID(), randomUUID(), snapshot, 1, 'mock');
  const before = await row(order.id);
  const attemptBefore = (await db.execute({ sql: 'SELECT * FROM payment_attempts WHERE order_id=?', args: [order.id] })).rows[0];
  await orders.payMock(order.id, session, new Date(Date.parse(String(before.created_at)) + 1000));
  const after = await row(order.id);
  assert.deepEqual(changedOrderColumns(before, after), ['paid_at', 'status', 'updated_at']);
  assert.equal(after.created_at, before.created_at);
  assert.equal(after.snapshot, before.snapshot);
  const attempt = (await db.execute({ sql: 'SELECT * FROM payment_attempts WHERE order_id=?', args: [order.id] })).rows[0];
  assert.equal(attempt.created_at, attemptBefore.created_at);
  assert.equal(attempt.status, 'paid');
  assert.equal(Number((await db.execute({ sql: 'SELECT COUNT(*) AS n FROM order_events WHERE order_id=?', args: [order.id] })).rows[0].n), 1);
});

test('order timeline timestamps are monotonic and match the audit log', async () => {
  const session = randomUUID();
  const order = await repository.persistPendingOrder(session, randomUUID(), randomUUID(), snapshot, 1, 'mock');
  const settled = await orders.payMock(order.id, session);
  const stored = await row(order.id);
  const audit = (await audits(order.id, 'order.status'))[0];
  assert.equal(settled.paymentStatus, 'paid');
  assert.ok(String(stored.created_at) <= String(stored.paid_at));
  assert.ok(String(stored.paid_at) <= String(stored.updated_at));
  assert.equal(JSON.parse(String(audit.diff)).status.to, 'paid');
  const drift = Date.parse(String(audit.at)) - Date.parse(String(stored.paid_at));
  assert.ok(drift >= 0 && drift < 5000);
  const event = (await db.execute({ sql: 'SELECT created_at FROM order_events WHERE order_id=?', args: [order.id] })).rows[0];
  assert.equal(event.created_at, stored.paid_at);
});

test('mock and real providers settle through the same persistence code', async () => {
  const mockSession = randomUUID();
  const mockOrder = await repository.persistPendingOrder(mockSession, randomUUID(), randomUUID(), snapshot, 1, 'mock');
  const cardSession = randomUUID();
  const cardOrder = await repository.persistPendingOrder(cardSession, randomUUID(), randomUUID(), snapshot, 1, 'mock');
  await db.execute({
    sql: "INSERT INTO payment_attempts (id,order_id,provider,status,created_at,updated_at) VALUES (?,?,'card','awaiting_payment',?,?)",
    args: [randomUUID(), cardOrder.id, new Date().toISOString(), new Date().toISOString()],
  });
  const mockBefore = await row(mockOrder.id);
  const cardBefore = await row(cardOrder.id);
  const settledAt = new Date(Math.max(Date.parse(String(mockBefore.created_at)), Date.parse(String(cardBefore.created_at))) + 1000);
  await orders.payMock(mockOrder.id, mockSession, settledAt);
  const card = { name: 'card', eventFor: (orderId: string) => ({ provider: 'card', reference: `card:${orderId}`, type: 'card.paid' }) };
  assert.equal(await payments.settlePayment(cardOrder.id, card.eventFor(cardOrder.id), { sessionHash: repository.hash(cardSession), method: 'mock' }, settledAt), true);
  const mockChanged = changedOrderColumns(mockBefore, await row(mockOrder.id));
  const cardChanged = changedOrderColumns(cardBefore, await row(cardOrder.id));
  assert.deepEqual(cardChanged, mockChanged);
  assert.equal((await audits(mockOrder.id, 'order.status'))[0].actor, 'mock-gateway');
  assert.equal((await audits(cardOrder.id, 'order.status'))[0].actor, 'card-gateway');
  assert.equal(JSON.parse(String((await row(cardOrder.id)).snapshot)).lines[0].totalMinor, JSON.parse(String((await row(mockOrder.id)).snapshot)).lines[0].totalMinor);
});

test('newly paid order appears in the since-poll without changing created_at', async () => {
  const older = await place();
  const session = randomUUID();
  const paid = await repository.persistPendingOrder(session, randomUUID(), randomUUID(), snapshot, 1, 'mock');
  const created = String((await row(paid.id)).created_at);
  const before = await orders.listOrders(admin, orderQuery.parse({ since: older.id, limit: 100 }));
  assert.equal(before.rows.some((item) => item.id === paid.id), false);
  await orders.payMock(paid.id, session);
  const after = await orders.listOrders(admin, orderQuery.parse({ since: older.id, limit: 100 }));
  assert.equal(after.rows.some((item) => item.id === paid.id), true);
  assert.equal((await row(paid.id)).created_at, created);
});

test('every order line stores its dish category id and name (snapshot v2)', async () => {
  const order = await place();
  const stored = JSON.parse(String((await row(order.id)).snapshot));
  assert.equal(stored.version, 2);
  assert.equal(stored.lines[0].categoryId, dish.section);
  assert.equal(stored.lines[0].categoryName, menu.categories.find((item) => item.id === dish.section)?.name);
  assert.ok(stored.lines[0].categoryNameAr);
  const legacy = ticketModel({ ...await row(order.id), snapshot: JSON.stringify({ version: 1, branchName: 'Down Town', lines: [{ name: 'Old line', quantity: 1, totalMinor: 100 }] }), print_count: 0, printed_at: null, customer_name: 'A', customer_phone: '97455551234', total_minor: 100, paid_at: null, payment_method: 'mock', created_at: '2026-10-23T12:00:00.000Z', order_number: 1, car_plate: null, car_colour: null, car_model: null });
  assert.equal(legacy.groups[0].name, 'Items');
});

test('order numbers are unique per branch under 20 concurrent checkouts and never change', async () => {
  const created = await Promise.all(Array.from({ length: 20 }, () => place()));
  const numbers = created.map((order) => order.orderNumber);
  assert.equal(new Set(numbers).size, 20);
  assert.ok(numbers.every((number) => typeof number === 'number' && number > 0));
  const other = await place('west-bay');
  assert.equal(other.orderNumber, 1);
  const sample = created[0];
  const before = (await row(sample.id)).order_number;
  await orders.transitionOrder(admin, sample.id, { expected: 'placed', to: 'accepted' }, ctx);
  assert.equal((await row(sample.id)).order_number, before);
});

test('reading the order list or detail does not purge anything', async () => {
  const order = await place();
  const at = new Date('2026-01-01T12:00:00Z');
  await orders.transitionOrder(admin, order.id, { expected: 'placed', to: 'cancelled', reason: 'duplicate' }, ctx, at);
  const phone = (await row(order.id)).customer_phone;
  await orders.listOrders(admin, orderQuery.parse({ limit: 100 }));
  await orders.detailOrder(admin, order.id, false, ctx);
  assert.equal((await row(order.id)).customer_phone, phone);
});

test('cron purge route rejects requests without the secret', async () => {
  const route = await import('../src/app/api/cron/purge-orders/route');
  const cases: HeadersInit[] = [{}, { authorization: 'Bearer wrong' }, { authorization: '' }];
  for (const headers of cases) {
    const response = await route.GET(new Request('http://localhost/api/cron/purge-orders', { headers }));
    assert.equal(response.status, 401);
    assert.equal(await response.text(), '');
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
});

test('cron purge is idempotent', async () => {
  const order = await place();
  const at = new Date('2026-02-01T12:00:00Z');
  await orders.transitionOrder(admin, order.id, { expected: 'placed', to: 'cancelled', reason: 'duplicate' }, ctx, at);
  const route = await import('../src/app/api/cron/purge-orders/route');
  const headers = { authorization: 'Bearer phase1-test-secret' };
  const first = await route.GET(new Request('http://localhost/api/cron/purge-orders', { headers }));
  const second = await route.GET(new Request('http://localhost/api/cron/purge-orders', { headers }));
  assert.equal((await first.json()).purged > 0, true);
  assert.equal((await second.json()).purged, 0);
  assert.equal((await row(order.id)).customer_phone, null);
  assert.equal(Number((await db.execute("SELECT COUNT(*) AS n FROM audit WHERE action='orders.purged'")).rows[0].n), 1);
});

test('cron purge removes only data past retention', async () => {
  const kept = await place();
  await orders.transitionOrder(admin, kept.id, { expected: 'placed', to: 'cancelled', reason: 'duplicate' }, ctx, new Date());
  const phone = (await row(kept.id)).customer_phone;
  const route = await import('../src/app/api/cron/purge-orders/route');
  await route.GET(new Request('http://localhost/api/cron/purge-orders', { headers: { authorization: 'Bearer phase1-test-secret' } }));
  assert.equal((await row(kept.id)).customer_phone, phone);
});

test('cron purge returns 503 on the live database host', () => {
  const result = spawnSync(process.execPath, ['--import', 'tsx', '--eval', `(async () => {
    const assert = (await import('node:assert/strict')).default;
    globalThis.fetch = () => { throw new Error('network must not be touched'); };
    const route = await import('./src/app/api/cron/purge-orders/route.ts');
    const response = await route.GET(new Request('http://localhost/api/cron/purge-orders', { headers: { authorization: 'Bearer secret' } }));
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { code: 'ORDERING_UNAVAILABLE' });
  })().catch((error) => { console.error(error); process.exit(1); })`], {
    encoding: 'utf8', timeout: 20000,
    env: { ...process.env, VERCEL: '1', VERCEL_ENV: 'preview', CMS_DATABASE_AUTH_TOKEN: '', CMS_ENV_GUARD: 'report', CMS_DATABASE_URL: `libsql://${LIVE_DATABASE_HOST}`, CRON_SECRET: 'secret' },
  });
  assert.equal(result.status, 0, result.stderr || String(result.error));
});

test('checkout for a branch not enabled for ordering is rejected', async () => {
  const route = await import('../src/app/api/orders/route');
  const response = await route.POST(new Request('http://localhost/api/orders', {
    method: 'POST',
    headers: { origin: 'http://localhost', host: 'localhost', 'content-type': 'application/json', 'idempotency-key': 'phase1-branch-key' },
    body: JSON.stringify({
      branchId: 'west-bay',
      customer: { name: 'Test customer', phone: '97455551234', plate: 'Q123456', colour: '', car: '', instructions: '' },
      lines: [{ dishId: dish.id, selection: {}, quantity: 1, note: '', expectedUnitMinor: 1 }],
    }),
  }));
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { code: 'BRANCH_UNAVAILABLE' });
});

test("branch user reading another branch's order by id gets 404", async () => {
  const order = await place('west-bay');
  await rejected(orders.detailOrder(downTown, order.id, false, ctx), 'NOT_FOUND');
});

test("branch user listing with ?branch= override gets only their own branch", async () => {
  const own = await place('down-town');
  const other = await place('west-bay');
  const listed = await orders.listOrders(downTown, orderQuery.parse({ branch: 'west-bay', limit: 100 }));
  assert.equal(listed.rows.some((item) => item.id === own.id), true);
  assert.equal(listed.rows.some((item) => item.id === other.id), false);
  assert.ok(listed.rows.every((item) => item.branchId === 'down-town'));
});

test("branch user changing another branch's order status gets 404, no state change and no audit row", async () => {
  const order = await place('west-bay');
  const before = await audits(order.id);
  await rejected(orders.transitionOrder(downTown, order.id, { expected: 'placed', to: 'accepted' }, ctx), 'NOT_FOUND');
  assert.equal((await row(order.id)).status, 'placed');
  assert.equal((await audits(order.id)).length, before.length);
});

test("polling ?since= cursor from another branch's order reveals nothing", async () => {
  const other = await place('west-bay');
  const listed = await orders.listOrders(downTown, orderQuery.parse({ since: other.id, limit: 100 }));
  assert.deepEqual(listed.rows, []);
  assert.equal(JSON.stringify(listed).includes(other.id), false);
});

test('non-admin changing their own role or branch gets 403 and the attempt is audited', async () => {
  const created = await staff.createStaff(adminActor, { username: `branch-${randomUUID().slice(0, 8)}`, password: 'password12', role: 'branch_staff', branchId: 'down-town' }, ctx);
  const actor = { userId: created.id, username: 'branch-user', role: 'branch_staff' as const, branchScope: downTown };
  await rejected(staff.changeStaff(actor, created.id, { role: 'admin' }, { ...ctx, actor: actor.username }), 'FORBIDDEN');
  const audit = (await db.execute({ sql: "SELECT * FROM audit WHERE action='user.change_denied' AND entity_id=?", args: [created.id] })).rows;
  assert.equal(audit.length, 1);
  assert.equal(audit[0].actor, actor.username);
  assert.equal((await db.execute({ sql: 'SELECT role FROM staff_users WHERE id=?', args: [created.id] })).rows[0].role, 'branch_staff');
});

test('role or branch change takes effect immediately on an existing session', async () => {
  const created = await staff.createStaff(adminActor, { username: `move-${randomUUID().slice(0, 8)}`, password: 'password12', role: 'branch_staff', branchId: 'down-town' }, ctx);
  const version = Number((await db.execute({ sql: 'SELECT auth_version FROM staff_users WHERE id=?', args: [created.id] })).rows[0].auth_version);
  const token = randomUUID();
  await db.execute({
    sql: 'INSERT INTO staff_sessions (token_hash,user_id,auth_version,expires,created_at) VALUES (?,?,?,?,?)',
    args: [auth.tokenHash(token), created.id, version, Date.now() + 60_000, new Date().toISOString()],
  });
  assert.equal((await auth.staffFromToken(token))?.branchScope.kind, 'branch');
  await staff.changeStaff(adminActor, created.id, { branchId: 'west-bay' }, ctx);
  assert.equal(await auth.staffFromToken(token), null);
  const next = Number((await db.execute({ sql: 'SELECT auth_version,branch_id FROM staff_users WHERE id=?', args: [created.id] })).rows[0].auth_version);
  const fresh = randomUUID();
  await db.execute({
    sql: 'INSERT INTO staff_sessions (token_hash,user_id,auth_version,expires,created_at) VALUES (?,?,?,?,?)',
    args: [auth.tokenHash(fresh), created.id, next, Date.now() + 60_000, new Date().toISOString()],
  });
  const principal = await auth.staffFromToken(fresh);
  assert.deepEqual(principal?.branchScope, { kind: 'branch', branchId: 'west-bay' });
});

test('disabled or unassigned user sees nothing', async () => {
  const created = await staff.createStaff(adminActor, { username: `off-${randomUUID().slice(0, 8)}`, password: 'password12', role: 'branch_staff', branchId: 'down-town' }, ctx);
  const token = randomUUID();
  await db.execute({
    sql: 'INSERT INTO staff_sessions (token_hash,user_id,auth_version,expires,created_at) VALUES (?,?,?,?,?)',
    args: [auth.tokenHash(token), created.id, 1, Date.now() + 60_000, new Date().toISOString()],
  });
  await staff.changeStaff(adminActor, created.id, { disabled: true }, ctx);
  assert.equal(await auth.staffFromToken(token), null);
  const orphan = `US-${randomUUID()}`;
  await db.execute({
    sql: `INSERT INTO staff_users (id,username,password_hash,role,branch_id,auth_version,disabled_at,created_at,updated_at) VALUES (?,?,?,'branch_staff',NULL,1,NULL,?,?)`,
    args: [orphan, `none-${randomUUID().slice(0, 8)}`, await passwords.hashPassword('password12'), new Date().toISOString(), new Date().toISOString()],
  });
  const listed = await orders.listOrders({ kind: 'none' }, orderQuery.parse({ limit: 100 }));
  assert.deepEqual(listed.rows, []);
  assert.equal(await auth.staffPasswordMatches(`none-missing`, 'password12'), false);
});

test('admin branch filter returns the right orders', async () => {
  const own = await place('down-town');
  const other = await place('west-bay');
  const listed = await orders.listOrders(admin, orderQuery.parse({ branch: 'west-bay', limit: 100 }));
  assert.equal(listed.rows.some((item) => item.id === other.id), true);
  assert.equal(listed.rows.some((item) => item.id === own.id), false);
});

test('every order query has a branch predicate', () => {
  const exempt = new Set(['payMock', 'purgeOrders', 'summary', 'maskPhone', 'maskPlate']);
  const sql = /FROM orders|UPDATE orders|INTO orders/;
  for (const file of ['src/ordering/orders.ts', 'src/ordering/printing.ts']) {
    const source = readFileSync(file, 'utf8');
    for (const chunk of source.split(/\n(?=(?:export )?(?:async )?function )/)) {
      const name = /^(?:export )?(?:async )?function (\w+)/.exec(chunk)?.[1];
      if (!name || exempt.has(name) || !sql.test(chunk)) continue;
      assert.match(chunk, /branch\.sql|branch_id/, `${file} ${name}`);
    }
  }
});

async function accept(id: string) {
  await orders.transitionOrder(admin, id, { expected: 'placed', to: 'accepted' }, ctx);
}

test('printing the same order twice claims it only once', async () => {
  const order = await place();
  await accept(order.id);
  const first = await printing.claimPrint(admin, order.id, 'auto');
  assert.ok(first.claimId);
  await rejected(printing.claimPrint(admin, order.id, 'auto'), 'PRINT_IN_PROGRESS');
  assert.equal((await row(order.id)).print_claim_id, first.claimId);
});

test('two tabs auto-printing at once print each order exactly once', async () => {
  const order = await place();
  await accept(order.id);
  const results = await Promise.all(Array.from({ length: 20 }, () => printing.claimPrint(admin, order.id, 'auto').then(() => 1, () => 0)));
  assert.equal(results.reduce((sum, value) => sum + value, 0), 1);
});

test("branch user printing another branch's order gets 404, no claim and no audit row", async () => {
  const order = await place('west-bay');
  await orders.transitionOrder(admin, order.id, { expected: 'placed', to: 'accepted' }, ctx);
  const before = (await audits(order.id)).length;
  await rejected(printing.claimPrint(downTown, order.id, 'manual'), 'NOT_FOUND');
  assert.equal((await row(order.id)).print_claim_id, null);
  assert.equal((await audits(order.id)).length, before);
});

test('reprint keeps printed_at, increments print_count and writes one order.reprinted audit row', async () => {
  const order = await place();
  await accept(order.id);
  const claim = await printing.claimPrint(admin, order.id, 'manual');
  const at = new Date('2026-10-23T18:00:00Z');
  await printing.confirmPrint(admin, order.id, claim.claimId, ctx, at);
  const printedAt = String((await row(order.id)).printed_at);
  const again = await printing.claimPrint(admin, order.id, 'reprint', new Date(at.getTime() + 1_000));
  await printing.confirmPrint(admin, order.id, again.claimId, ctx, new Date(at.getTime() + 2_000));
  const stored = await row(order.id);
  assert.equal(stored.printed_at, printedAt);
  assert.equal(Number(stored.print_count), 2);
  assert.equal((await audits(order.id, 'order.reprinted')).length, 1);
  assert.deepEqual(JSON.parse(String((await audits(order.id, 'order.reprinted'))[0].diff)), { count: 2 });
});

test('print claim and confirm change no non-print order field', async () => {
  const order = await place();
  await accept(order.id);
  const before = await row(order.id);
  const claim = await printing.claimPrint(admin, order.id, 'manual');
  const claimed = await row(order.id);
  assert.deepEqual(changedOrderColumns(before, claimed), ['print_claim_id', 'print_claimed_at']);
  await printing.confirmPrint(admin, order.id, claim.claimId, ctx);
  const confirmed = await row(order.id);
  assert.deepEqual(changedOrderColumns(claimed, confirmed).filter((key) => !['print_claim_id', 'print_claimed_at', 'print_count', 'printed_at'].includes(key)), []);
  assert.equal(confirmed.status, claimed.status);
  assert.equal(confirmed.updated_at, claimed.updated_at);
  assert.equal(confirmed.created_at, claimed.created_at);
  assert.equal(confirmed.snapshot, claimed.snapshot);
});

test('expired auto claim is never auto-printed again but can be printed manually', async () => {
  const order = await place();
  await accept(order.id);
  const at = new Date('2026-10-23T18:00:00Z');
  await printing.claimPrint(admin, order.id, 'auto', at);
  const later = new Date(at.getTime() + 3 * 60 * 1000);
  await rejected(printing.claimPrint(admin, order.id, 'auto', later), 'ALREADY_PRINTED');
  const manual = await printing.claimPrint(admin, order.id, 'manual', later);
  assert.ok(manual.claimId);
});

test('ticket lines and total match the order snapshot after the menu price changes', async () => {
  const order = await place();
  const stored = await row(order.id);
  const snap = JSON.parse(String(stored.snapshot));
  const changed = structuredClone(menu);
  const edited = changed.dishes.find((item) => item.id === dish.id)!;
  if (edited.kind.type === 'simple') edited.kind.priceQar += 25;
  const newMinor = Math.round(unitPrice(edited, defaultSelection(edited)) * snap.lines[0].quantity);
  assert.notEqual(newMinor, snap.totalMinor);
  const money = { currencyEn: 'QAR', currencyAr: 'ر.ق' };
  const model = ticketModel(stored);
  assert.equal(model.total, formatQar(snap.totalMinor / 100, 'en', money));
  assert.notEqual(model.total, formatQar(newMinor / 100, 'en', money));
  assert.equal(model.groups.flatMap((group) => group.lines).map((line) => line.name).join(','), snap.lines.map((line: { name: string }) => line.name).join(','));
});

test('ticket shows the order time in Asia/Qatar', async () => {
  const order = await place();
  await db.execute({ sql: 'UPDATE orders SET created_at=? WHERE id=?', args: ['2026-06-21T20:00:00.000Z', order.id] });
  const model = ticketModel(await row(order.id));
  assert.equal(model.placed, '2026-06-21 23:00');
});
});
