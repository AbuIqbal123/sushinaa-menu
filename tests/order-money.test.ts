import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatMinor, minorAmount, signedMinorAmount } from '../src/lib/money';
import { applyEdits, editPreview, editReasonLabel, orderShortCode, orderTotals, type ResolvedEdit, type WorkingLine } from '../src/ordering/edits';

const line = (id: string, unitMinor: number, quantity = 1): WorkingLine => ({
  id, dishId: id, name: id, nameAr: id, quantity, unitMinor, note: '', voided: false, compliment: false,
  discount: null, selection: {}, categoryName: 'Items', categoryNameAr: '', categoryOrder: 0,
});
// 35.00 + 2 x 30.00 + 42.00 = 137.00
const order = [line('L0', 3500), line('L1', 3000, 2), line('L2', 4200)];
const totalsAfter = (edits: ResolvedEdit[], lines = order) => orderTotals(applyEdits(lines, edits));

test('money always prints two decimals from integer minor units', () => {
  assert.equal(minorAmount(4800), '48.00');
  assert.equal(minorAmount(0), '0.00');
  assert.equal(minorAmount(-0), '0.00');
  assert.equal(minorAmount(5), '0.05');
  assert.equal(minorAmount(-480), '-4.80');
  assert.equal(minorAmount(7820), '78.20');
  assert.equal(minorAmount(123456789), '1234567.89');
  assert.equal(formatMinor(4800, 'en'), '48.00 QAR');
  assert.equal(formatMinor(4800, 'ar'), '48.00 ر.ق');
  assert.equal(formatMinor(-480, 'en', { currencyEn: 'QR', currencyAr: 'ر.ق' }), '-4.80 QR');
});

test('money refuses fractions and unsafe numbers instead of rounding them silently', () => {
  assert.throws(() => minorAmount(48.5), RangeError);
  assert.throws(() => minorAmount(Number.NaN), RangeError);
  assert.throws(() => minorAmount(Number.MAX_SAFE_INTEGER + 2), RangeError);
});

test('a change carries its sign', () => {
  assert.equal(signedMinorAmount(4500), '+45.00');
  assert.equal(signedMinorAmount(-480), '-4.80');
  assert.equal(signedMinorAmount(0), '0.00');
});

test('subtotal is before any discount and the rows add up', () => {
  assert.deepEqual(totalsAfter([]), { subtotalMinor: 13700, discountMinor: 0, totalMinor: 13700 });
  // 10% off 60.00 = 6.00; 15% off the 131.00 left = 19.65.
  const t = totalsAfter([
    { kind: 'line_discount', lineId: 'L1', discount: { mode: 'percent', bp: 1000 } },
    { kind: 'order_discount', discount: { mode: 'percent', bp: 1500 } },
  ]);
  assert.deepEqual(t, { subtotalMinor: 13700, discountMinor: 2565, totalMinor: 11135 });
  assert.equal(t.subtotalMinor - t.discountMinor, t.totalMinor);
});

test('percent discounts round half up to the minor unit', () => {
  // 12.5% of 0.99 = 0.12375 -> 0.12; 50% of 0.05 = 0.025 -> 0.03.
  assert.equal(totalsAfter([{ kind: 'line_discount', lineId: 'A', discount: { mode: 'percent', bp: 1250 } }], [line('A', 99)]).discountMinor, 12);
  assert.equal(totalsAfter([{ kind: 'line_discount', lineId: 'A', discount: { mode: 'percent', bp: 5000 } }], [line('A', 5)]).discountMinor, 3);
});

test('a comp counts in Subtotal and in Discounts & comps; a void counts in neither', () => {
  assert.deepEqual(totalsAfter([{ kind: 'compliment', lineId: 'L0' }]), { subtotalMinor: 13700, discountMinor: 3500, totalMinor: 10200 });
  assert.deepEqual(totalsAfter([{ kind: 'void', lineId: 'L0' }]), { subtotalMinor: 10200, discountMinor: 0, totalMinor: 10200 });
});

test('a 0.00 total is allowed and a discount past zero is rejected', () => {
  assert.deepEqual(totalsAfter([{ kind: 'order_discount', discount: { mode: 'amount', amountMinor: 13700 } }]), { subtotalMinor: 13700, discountMinor: 13700, totalMinor: 0 });
  assert.throws(() => totalsAfter([{ kind: 'order_discount', discount: { mode: 'amount', amountMinor: 13701 } }]));
});

test('the sheet shows was only when the total moves', () => {
  const current = totalsAfter([]);
  assert.deepEqual(editPreview(current, current, { paid: false, owedBackMinor: 0 }),
    { subtotalMinor: 13700, changeMinor: 0, totalMinor: 13700, wasMinor: null, owedBackMinor: null, blocked: false });
  // 4.80 off a line: Subtotal stays the pre-discount 137.00.
  const next = totalsAfter([{ kind: 'line_discount', lineId: 'L1', discount: { mode: 'amount', amountMinor: 480 } }]);
  assert.deepEqual(editPreview(current, next, { paid: false, owedBackMinor: 0 }),
    { subtotalMinor: 13700, changeMinor: -480, totalMinor: 13220, wasMinor: 13700, owedBackMinor: null, blocked: false });
});

test('a paid order can go down (owed back grows) but never up', () => {
  const current = orderTotals({ lines: [line('A', 3500)], totalMinor: 3500 });
  const added = orderTotals(applyEdits([line('A', 3500)], [{ kind: 'add_item', line: line('B', 4500) }]));
  const up = editPreview(current, added, { paid: true, owedBackMinor: 0 });
  assert.deepEqual(up, { subtotalMinor: 8000, changeMinor: 4500, totalMinor: 8000, wasMinor: 3500, owedBackMinor: 0, blocked: true });
  assert.equal(editPreview(current, added, { paid: false, owedBackMinor: 0 }).blocked, false);
  const voided = orderTotals(applyEdits([line('A', 3500), line('B', 1000)], [{ kind: 'void', lineId: 'B' }]));
  const down = editPreview(orderTotals({ lines: [line('A', 3500), line('B', 1000)], totalMinor: 4500 }), voided, { paid: true, owedBackMinor: 200 });
  assert.deepEqual(down, { subtotalMinor: 3500, changeMinor: -1000, totalMinor: 3500, wasMinor: 4500, owedBackMinor: 1200, blocked: false });
});

test('orders show a short code and readable reasons, never a raw id', () => {
  assert.equal(orderShortCode('SU-591e5873-5eac-4f97-9b32-d16ea046bd35'), 'SU-591e5873');
  assert.equal(editReasonLabel('goodwill', 'en'), 'Goodwill');
  assert.equal(editReasonLabel('goodwill', 'ar'), 'مجاملة');
  assert.equal(editReasonLabel('made_up', 'en'), 'made up');
});
