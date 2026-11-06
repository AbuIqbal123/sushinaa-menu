import assert from 'node:assert/strict';
import { test } from 'node:test';
import { couponOrderOpen } from '../src/ordering/coupons/linked-order';

test('online redeemed coupon still cooking opens active Orders, not History', () => {
  assert.deepEqual(
    couponOrderOpen({
      orderId: 'SU-paid',
      status: 'paid',
      paymentMethod: 'sadad',
      paidAt: '2026-11-06T12:00:00.000Z',
    }),
    { section: 'orders', view: 'active', orderId: 'SU-paid' },
  );
  assert.deepEqual(
    couponOrderOpen({
      orderId: 'SU-ready',
      status: 'ready',
      paymentMethod: 'sadad',
      paidAt: '2026-11-06T12:00:00.000Z',
    }),
    { section: 'orders', view: 'active', orderId: 'SU-ready' },
  );
});

test('collected or cancelled redeemed coupon opens History', () => {
  assert.deepEqual(
    couponOrderOpen({
      orderId: 'SU-done',
      status: 'completed',
      paymentMethod: 'sadad',
      paidAt: '2026-11-06T12:00:00.000Z',
    }),
    { section: 'orders', view: 'history', orderId: 'SU-done' },
  );
  assert.deepEqual(
    couponOrderOpen({
      orderId: 'SU-cancel',
      status: 'cancelled',
      paymentMethod: 'mock',
      paidAt: '2026-11-06T12:00:00.000Z',
    }),
    { section: 'orders', view: 'history', orderId: 'SU-cancel' },
  );
});

test('unpaid Sadad or mock hold opens Payments (not kitchen Orders)', () => {
  assert.deepEqual(
    couponOrderOpen({
      orderId: 'SU-hold',
      status: 'placed',
      paymentMethod: 'sadad',
      paidAt: null,
    }),
    { section: 'payments', orderId: 'SU-hold' },
  );
  assert.deepEqual(
    couponOrderOpen({
      orderId: 'SU-mock-hold',
      status: 'placed',
      paymentMethod: 'mock',
      paidAt: null,
    }),
    { section: 'payments', orderId: 'SU-mock-hold' },
  );
});

test('pay-at-pickup hold is kitchen-visible on active Orders', () => {
  assert.deepEqual(
    couponOrderOpen({
      orderId: 'SU-pickup',
      status: 'placed',
      paymentMethod: 'pay_at_pickup',
      paidAt: null,
    }),
    { section: 'orders', view: 'active', orderId: 'SU-pickup' },
  );
});
