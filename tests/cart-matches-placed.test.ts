import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cartMatchesPlaced } from '../src/ordering/checkout/cart-matches-placed';

const base = {
  dishId: 'burger',
  selection: { size: 'reg' },
  quantity: 1,
  note: '',
  unitMinor: 6300,
};

test('empty baskets match', () => {
  assert.equal(cartMatchesPlaced([], []), true);
});

test('same lines in different order still match', () => {
  const a = [
    { ...base, dishId: 'a', quantity: 1 },
    { ...base, dishId: 'b', quantity: 2, unitMinor: 1000 },
  ];
  const b = [
    { ...base, dishId: 'b', quantity: 2, unitMinor: 1000 },
    { ...base, dishId: 'a', quantity: 1 },
  ];
  assert.equal(cartMatchesPlaced(a, b), true);
});

test('added item does not match', () => {
  assert.equal(
    cartMatchesPlaced(
      [base, { ...base, dishId: 'extra', unitMinor: 2000 }],
      [base],
    ),
    false,
  );
});

test('quantity change does not match', () => {
  assert.equal(
    cartMatchesPlaced([{ ...base, quantity: 2 }], [base]),
    false,
  );
});

test('note or unit change does not match', () => {
  assert.equal(cartMatchesPlaced([{ ...base, note: 'no onion' }], [base]), false);
  assert.equal(cartMatchesPlaced([{ ...base, unitMinor: 5000 }], [base]), false);
});
