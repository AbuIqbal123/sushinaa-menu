import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  attemptFromPredicate,
  canAttemptTransition,
  deriveCustomerPaymentStatus,
  fromStatusesFor,
  markAttemptPaidForProviderStatement,
  openAttemptPredicate,
  sealedAttemptStatuses,
} from '../src/ordering/payment-attempt';
import { canCouponTransition } from '../src/ordering/coupons/lifecycle';
import { isTransitionEdge, canTransition } from '../src/ordering/status';
import { printPhase, claimStillLive } from '../src/ordering/print-claim';

test('kitchen edges do not need a fake paidAt string', () => {
  assert.equal(isTransitionEdge('cancelled', 'refunded'), true);
  assert.equal(canTransition('cancelled', 'refunded', null), false);
  assert.equal(canTransition('cancelled', 'refunded', '2026-01-01'), true);
  assert.equal(isTransitionEdge('placed', 'paid'), false);
});

test('payment attempt graph seals paid/failed/cancelled', () => {
  assert.equal(canAttemptTransition('awaiting_payment', 'paid'), true);
  assert.equal(canAttemptTransition('awaiting_payment', 'cancelled'), true);
  assert.equal(canAttemptTransition('paid', 'cancelled'), false);
  assert.equal(canAttemptTransition('cancelled', 'awaiting_payment'), false);
  assert.deepEqual([...sealedAttemptStatuses], ['paid', 'failed', 'cancelled']);
  assert.match(openAttemptPredicate(), /NOT IN/);
});

test('attempt writers only accept graph-legal from statuses', () => {
  assert.deepEqual([...fromStatusesFor('processing')], ['awaiting_payment', 'processing', 'failed']);
  assert.deepEqual([...fromStatusesFor('paid')], ['awaiting_payment', 'processing', 'failed']);
  assert.match(attemptFromPredicate('processing'), /awaiting_payment/);
  assert.doesNotMatch(attemptFromPredicate('processing'), /'paid'/);
  assert.doesNotMatch(attemptFromPredicate('paid'), /'cancelled'/);
  const markPaid = markAttemptPaidForProviderStatement('o', 'sadad', 't', 'r');
  assert.ok(typeof markPaid === 'object' && markPaid !== null && 'sql' in markPaid);
  assert.match(markPaid.sql, /status IN/);
});

test('customer paymentStatus derivation has one owner', () => {
  assert.equal(deriveCustomerPaymentStatus({
    paidAt: '2026-01-01', paymentMethod: 'sadad', createdAt: '2026-01-01T00:00:00.000Z',
  }), 'paid');
  assert.equal(deriveCustomerPaymentStatus({
    paidAt: null, paymentMethod: 'pay_at_pickup', createdAt: '2026-01-01T00:00:00.000Z',
  }), 'pending');
  assert.equal(deriveCustomerPaymentStatus({
    paidAt: null,
    paymentMethod: 'sadad',
    createdAt: '2020-01-01T00:00:00.000Z',
    nowMs: Date.parse('2020-01-01T01:00:00.000Z'),
  }), 'expired');
  assert.equal(deriveCustomerPaymentStatus({
    paidAt: null,
    paymentMethod: 'mock',
    createdAt: '2020-01-01T00:00:00.000Z',
    nowMs: Date.parse('2020-01-01T00:10:00.000Z'),
  }), 'awaiting_payment');
});

test('coupon graph is available→held→redeemed|available, available→disabled', () => {
  assert.equal(canCouponTransition('available', 'held'), true);
  assert.equal(canCouponTransition('available', 'disabled'), true);
  assert.equal(canCouponTransition('held', 'redeemed'), true);
  assert.equal(canCouponTransition('held', 'available'), true);
  assert.equal(canCouponTransition('redeemed', 'available'), false);
  assert.equal(canCouponTransition('disabled', 'available'), false);
  assert.equal(canCouponTransition('available', 'redeemed'), false);
});

test('print phases follow claim columns', () => {
  assert.equal(printPhase({ print_count: 0 }), 'unprinted');
  assert.equal(printPhase({ print_count: 0, print_claim_id: 'c1' }), 'claimed');
  assert.equal(printPhase({ print_count: 1, printed_at: 't' }), 'printed');
  assert.equal(claimStillLive(1_000, 1_000 + 30_000, 120_000), true);
  assert.equal(claimStillLive(1_000, 1_000 + 180_000, 120_000), false);
});
