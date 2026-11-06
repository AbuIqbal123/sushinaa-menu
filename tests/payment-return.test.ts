import assert from 'node:assert/strict';
import { test } from 'node:test';
import { callbackReturnKind } from '../src/ordering/payment-return';

test('callback return uses paid only when outcome is paid and settled', () => {
  assert.equal(callbackReturnKind('paid', { settled: true }), 'paid');
  assert.equal(callbackReturnKind('paid', { settled: false, alreadyPaid: true }), 'paid');
  assert.equal(callbackReturnKind('paid', { settled: false }), 'failed');
  assert.equal(callbackReturnKind('failed', { settled: false }), 'failed');
  assert.equal(callbackReturnKind('paid', { applied: false, reason: 'AMOUNT_MISMATCH' }), 'failed');
  assert.equal(callbackReturnKind('paid', { applied: false, reason: 'NOT_FOUND' }), 'failed');
});
