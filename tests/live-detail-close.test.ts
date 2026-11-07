import assert from 'node:assert/strict';
import { test } from 'node:test';
import { closeLiveDetailOnRefresh } from '../src/ordering/live-detail-close';

test('live detail closes only for terminal statuses when closeOnTerminal is on', () => {
  assert.equal(closeLiveDetailOnRefresh('placed', true), false);
  assert.equal(closeLiveDetailOnRefresh('ready', true), false);
  assert.equal(closeLiveDetailOnRefresh('completed', true), true);
  assert.equal(closeLiveDetailOnRefresh('cancelled', true), true);
  assert.equal(closeLiveDetailOnRefresh('refunded', true), true);
  assert.equal(closeLiveDetailOnRefresh('completed', false), false);
});
