import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CUSTOMER_RECEIPT_TTL_MS,
  isTerminalCustomerStatus,
  shouldResumeCustomerReceipt,
} from '../src/ordering/customer-tracking';

test('live statuses always resume', () => {
  for (const status of ['placed', 'paid', 'accepted', 'preparing', 'ready']) {
    assert.equal(shouldResumeCustomerReceipt({ status, updatedAt: '2000-01-01T00:00:00.000Z' }), true);
  }
});

test('collected orders resume only within the TTL', () => {
  const updatedAt = '2026-11-05T12:00:00.000Z';
  const collected = Date.parse(updatedAt);
  assert.equal(isTerminalCustomerStatus('completed'), true);
  assert.equal(shouldResumeCustomerReceipt({ status: 'completed', updatedAt }, collected + 60_000), true);
  assert.equal(
    shouldResumeCustomerReceipt({ status: 'completed', updatedAt }, collected + CUSTOMER_RECEIPT_TTL_MS - 1),
    true,
  );
  assert.equal(
    shouldResumeCustomerReceipt({ status: 'completed', updatedAt }, collected + CUSTOMER_RECEIPT_TTL_MS),
    false,
  );
});

test('cancelled and refunded follow the same expiry', () => {
  const updatedAt = '2026-11-05T18:00:00.000Z';
  const at = Date.parse(updatedAt);
  assert.equal(shouldResumeCustomerReceipt({ status: 'cancelled', updatedAt }, at + 3_600_000), true);
  assert.equal(shouldResumeCustomerReceipt({ status: 'refunded', updatedAt }, at + CUSTOMER_RECEIPT_TTL_MS + 1), false);
});

test('terminal orders without a usable timestamp do not trap the customer', () => {
  assert.equal(shouldResumeCustomerReceipt({ status: 'completed' }), false);
  assert.equal(shouldResumeCustomerReceipt({ status: 'completed', updatedAt: 'not-a-date' }), false);
});
