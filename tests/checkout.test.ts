import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { branches, branchStatus } from '../src/ordering/checkout/branches';
import { checkoutSchema, customerSchema, quoteOrder, validCheckoutSelection, type CheckoutInput } from '../src/ordering/checkout/validation';
import { defaultSelection, serializeSelection, parseSelection, isSelectionComplete, unitPrice } from '../src/ordering/price';
import { menuSchema, publicMenu } from '../src/cms/schema';
import { beginHostedPayment } from '../src/ordering/checkout/payment';
const menu = menuSchema.parse(JSON.parse(readFileSync('data/initial-menu.json', 'utf8')));
const at = (date: string) => new Date(`${date}+03:00`);
const open = (id: string, date: string) => branchStatus(branches.find(b => b.id === id)!, at(date)).open;
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
    const [start, end] = b.hours(day);
    const midnight = new Date(`2026-10-${18 + day}T00:00:00+03:00`).getTime();
    assert.equal(branchStatus(b, new Date(midnight + start * 60000 - 1)).open, false, `${b.id} ${day} before opening`);
    assert.equal(branchStatus(b, new Date(midnight + start * 60000)).open, true);
    assert.equal(branchStatus(b, new Date(midnight + end * 60000 - 1)).open, true);
    assert.equal(branchStatus(b, new Date(midnight + end * 60000)).open, false);
  }
});
const customer = { name: 'علي O’Neil', phone: '+974 ٥٥٥٥ ١٢٣٤', plate: '٠٠١٢٣', colour: '', car: '', instructions: '' };
test('normalises Arabic and Persian digits and requires a numeric plate', () => {
  const parsed = customerSchema.parse(customer);
  assert.equal(parsed.phone, '97455551234'); assert.equal(parsed.plate, '00123');
  assert.equal(customerSchema.parse({ ...customer, phone: '۰۰۹۷۴۵۵۵۵۱۲۳۴' }).phone, '97455551234');
  assert.equal(customerSchema.safeParse({ ...customer, phone: '111' }).success, false);
  assert.equal(customerSchema.safeParse({ ...customer, plate: '<script>' }).success, false);
  assert.equal(customerSchema.safeParse({ ...customer, plate: '123 A' }).success, false);
  assert.equal(customerSchema.safeParse({ ...customer, plate: '123-45' }).success, false);
});
const roll = publicMenu(menu).dishes.find(d => d.kind.type === 'roll' && d.kind.proteins.some(p => p.prices[4] && p.prices[8]))!;
assert.equal(roll.kind.type, 'roll');
const protein = roll.kind.proteins.find(p => p.prices[4] && p.prices[8])!;
const selection = { ...defaultSelection(roll), protein: protein.id };
const input: CheckoutInput = checkoutSchema.parse({ branchId: 'down-town', customer, lines: [
  { dishId: roll.id, selection: { ...selection, pieces: 4 }, quantity: 1, note: 'No cucumber', expectedUnitMinor: protein.prices[4]! * 100 },
  { dishId: roll.id, selection: { ...selection, pieces: 8 }, quantity: 2, note: 'Sauce on the side', expectedUnitMinor: protein.prices[8]! * 100 },
] });
test('distinct servings retain notes, portions and server-calculated integer totals', () => {
  const order = quoteOrder(input, menu, at('2026-10-22T15:00:00'));
  assert.equal(order.lines.length, 2); assert.equal(order.lines[0].note, 'No cucumber');
  assert.equal(order.lines[1].selection.pieces, 8);
  assert.equal(order.totalMinor, protein.prices[4]! * 100 + 2 * protein.prices[8]! * 100);
});
test('rejects changed prices, hidden dishes, invalid choices, duplicate extras and closed branches', () => {
  assert.throws(() => quoteOrder({ ...input, lines: [{ ...input.lines[0], expectedUnitMinor: 1 }] }, menu, at('2026-10-22T15:00:00')), /PRICE_CHANGED/);
  const hidden = structuredClone(menu); hidden.dishes.find(d => d.id === roll.id)!.available = false;
  assert.throws(() => quoteOrder(input, hidden, at('2026-10-22T15:00:00')), /UNAVAILABLE/);
  assert.throws(() => quoteOrder(input, menu, at('2026-10-23T03:00:00')), /CLOSED/);
  assert.equal(validCheckoutSelection(roll, { ...input.lines[0].selection, protein: 'invented' }), false);
  assert.equal(validCheckoutSelection(roll, { ...input.lines[0].selection, size: 'invented' }), false);
  assert.equal(checkoutSchema.safeParse({ ...input, totalMinor: 1 }).success, false);
  assert.equal(checkoutSchema.safeParse({ ...input, lines: [{ ...input.lines[0], selection: { ...selection, extras: ['x', 'x'] } }] }).success, false);
});
test('payment adapter cannot return a fake checkout URL or mark an order paid', async () => {
  assert.deepEqual(await beginHostedPayment('anything?paid=true'), { available: false, code: 'PAYMENT_NOT_CONNECTED' });
});

test('all complete menu selections remain valid after the real basket serialization round trip', () => {
  for (const dish of publicMenu(menu).dishes) {
    const selection = parseSelection(serializeSelection(defaultSelection(dish)));
    if (!isSelectionComplete(dish, selection)) continue; // Boxes intentionally need customer choices.
    assert.equal(validCheckoutSelection(dish, selection), true, dish.id);
    const order = quoteOrder({ ...input, lines: [{ dishId: dish.id, selection, quantity: 1, note: '', expectedUnitMinor: Math.round(unitPrice(dish, selection) * 100) }] }, menu, at('2026-10-22T15:00:00'));
    assert.equal(order.totalMinor, Math.round(unitPrice(dish, selection) * 100));
  }
});
