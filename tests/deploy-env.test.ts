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
  assert.equal(orderDatabaseAllowed(`libsql://${LIVE_DATABASE_HOST}`), false);
  assert.equal(orderDatabaseAllowed(`libsql://${LIVE_DATABASE_HOST}.`), false);
  assert.equal(orderDatabaseAllowed(`libsql://${LIVE_DATABASE_HOST}%2e`), false);
  assert.equal(orderDatabaseAllowed(`libsql://evil.test\\@${LIVE_DATABASE_HOST}`), false);
  assert.equal(orderDatabaseAllowed(`libsql://evil.test@${LIVE_DATABASE_HOST}`), false);
  assert.equal(orderDatabaseAllowed('libsql://sushinaa-cms-dev-example.turso.io'), true);
  assert.equal(orderDatabaseAllowed('file:./data/menu.db'), true);
  assert.equal(touchesLiveDatabaseHost(`libsql://evil.test\\@${LIVE_DATABASE_HOST}`), true);
  assert.equal(touchesLiveDatabaseHost('libsql://sushinaa-cms-dev-example.turso.io'), false);
});
