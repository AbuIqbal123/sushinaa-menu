import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  PAYMENT_FAIL_RETRY_LIMIT,
  paymentFailCopy,
  paymentFailNoticeKind,
} from '../src/ordering/payment-fail-notice';

const text = (en: string, _ar: string) => en;

test('first failed payment offers another try', () => {
  assert.equal(paymentFailNoticeKind(0), 'retry');
  assert.equal(paymentFailNoticeKind(1), 'retry');
  assert.equal(paymentFailNoticeKind(PAYMENT_FAIL_RETRY_LIMIT - 1), 'retry');
});

test('multiple failed payments ask the customer to try later', () => {
  assert.equal(paymentFailNoticeKind(PAYMENT_FAIL_RETRY_LIMIT), 'later');
  assert.equal(paymentFailNoticeKind(PAYMENT_FAIL_RETRY_LIMIT + 3), 'later');
  const copy = paymentFailCopy('later', text);
  assert.match(copy.title, /still did not go through/i);
  assert.match(copy.body, /try again later/i);
  assert.equal(copy.body.includes('\u2014'), false);
  assert.equal(paymentFailCopy('retry', text).body.includes('\u2014'), false);
});
