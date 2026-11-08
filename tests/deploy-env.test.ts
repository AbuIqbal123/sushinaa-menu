import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LIVE_DATABASE_HOST,
  databaseHost,
  touchesLiveDatabaseHost,
} from '../src/lib/deploy-env';
import { orderDatabaseAllowed } from '../src/ordering/guard';

test('databaseHost strips trailing dots and ignores file urls', () => {
  assert.equal(databaseHost(`libsql://${LIVE_DATABASE_HOST}.`), LIVE_DATABASE_HOST);
  assert.equal(databaseHost(`libsql://${LIVE_DATABASE_HOST}%2e`), LIVE_DATABASE_HOST);
  assert.equal(databaseHost('file:./data/menu.db'), null);
});

test('orderDatabaseAllowed refuses live host aliases libsql still dials', () => {
  const withUserinfo = ['libsql://', 'evil.test', String.fromCharCode(64), LIVE_DATABASE_HOST].join('');
  const withBackslashUserinfo = ['libsql://', 'evil.test', '\\', String.fromCharCode(64), LIVE_DATABASE_HOST].join('');
  assert.equal(orderDatabaseAllowed(`libsql://${LIVE_DATABASE_HOST}`), false);
  assert.equal(orderDatabaseAllowed(`libsql://${LIVE_DATABASE_HOST}.`), false);
  assert.equal(orderDatabaseAllowed(`libsql://${LIVE_DATABASE_HOST}%2e`), false);
  assert.equal(orderDatabaseAllowed(withBackslashUserinfo), false);
  assert.equal(orderDatabaseAllowed(withUserinfo), false);
  assert.equal(orderDatabaseAllowed('libsql://sushinaa-cms-dev-example.turso.io'), true);
  assert.equal(orderDatabaseAllowed('file:./data/menu.db'), true);
  assert.equal(touchesLiveDatabaseHost(withBackslashUserinfo), true);
  assert.equal(touchesLiveDatabaseHost('libsql://sushinaa-cms-dev-example.turso.io'), false);
});
