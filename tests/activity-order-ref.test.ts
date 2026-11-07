import assert from 'node:assert/strict';
import { test } from 'node:test';
import { staffOrderRef } from '../src/ordering/staff-order-ref';

test('staff order ref prefers kitchen number and shows Sadad txn beside it', () => {
  assert.equal(
    staffOrderRef(11107001, 'txn-42', 'SU-deadbeef'),
    '#011107001 · Sadad txn-42',
  );
  assert.equal(
    staffOrderRef(11107001, 'txn-42', 'SU-deadbeef', 'ar'),
    '#011107001 · سداد txn-42',
  );
  assert.equal(staffOrderRef(11107001, null, 'SU-deadbeef'), '#011107001');
  assert.equal(staffOrderRef(null, null, 'SU-deadbeef'), 'SU-deadbeef');
});
