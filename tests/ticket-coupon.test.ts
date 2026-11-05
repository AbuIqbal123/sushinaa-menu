import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { DbRow } from '../src/cms/sql';
import { ticketModel } from '../src/ordering/ticket';

function stored(snapshot: unknown, totalMinor: number): DbRow {
  return {
    id: 'SU-00000000-0000-0000-0000-000000000001',
    branch_id: 'down-town',
    created_at: '2026-10-28T12:00:00Z',
    customer_name: 'Preview',
    customer_phone: '97455551234',
    car_plate: 'Q123456',
    car_colour: 'White',
    car_model: 'Camry',
    total_minor: totalMinor,
    payment_method: 'mock',
    paid_at: '2026-10-28T12:00:00Z',
    order_number: 12,
    print_count: 0,
    printed_at: null,
    amended_at: null,
    instructions: '',
    snapshot: JSON.stringify(snapshot),
  } as DbRow;
}

const roll = { name: 'Salmon roll', nameAr: 'سلمون', quantity: 1, unitMinor: 1000, note: '', categoryName: 'Rolls', categoryOrder: 1 };

test('a coupon on the snapshot prints the code, the Arabic label, and the discount', () => {
  const model = ticketModel(stored({
    version: 2,
    lines: [roll],
    coupon: { code: 'A7K2M9QX', kind: 'amount', value: 100, discountMinor: 100 },
  }, 900));
  const coupon = model.groups.flatMap((group) => group.lines).find((line) => line.name.startsWith('Coupon'));
  assert.equal(coupon?.name, 'Coupon A7K2M9QX');
  assert.equal(coupon?.nameAr, 'قسيمة A7K2M9QX');
  assert.equal(coupon?.amount, '-1.00');
  assert.equal(model.subtotal, '10.00');
  assert.equal(model.discount, '1.00');
  assert.equal(model.amountDue, '9.00');
});

test('an order without a coupon prints no coupon line', () => {
  const model = ticketModel(stored({ version: 2, lines: [roll] }, 1000));
  assert.deepEqual(model.groups.flatMap((group) => group.lines).map((line) => line.name), ['Salmon roll']);
  assert.equal(model.discount, '0.00');
  assert.equal(model.amountDue, '10.00');
});
