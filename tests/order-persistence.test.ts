import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { OrderSnapshot } from '../src/ordering/checkout/quote';
test('concurrent retries create one pending order; changed body conflicts; another session cannot reuse it', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sushinaa-orders-'));
  process.env.CMS_DATABASE_URL = `file:${join(dir, 'orders.db')}`;
  const { persistPendingOrder } = await import('../src/ordering/checkout/repository');
  const snapshot: OrderSnapshot = { branchId: 'down-town', branchName: 'Down Town', collection: 'car', customer: { name: 'Test', phone: '97455551234', brand: 'toyota', plate: 'Q001', colour: '', car: '', instructions: '' }, lines: [], totalMinor: 100, currency: 'QAR' };
  try {
    const orders = await Promise.all(Array.from({ length: 5 }, () => persistPendingOrder('session-a', 'key-one', 'hash-one', snapshot, 17)));
    assert.equal(new Set(orders.map(o => o.id)).size, 1);
    assert.equal(orders.filter(o => !o.reused).length, 1);
    assert.ok(orders.every(o => o.paymentStatus === 'awaiting_payment'));
    await assert.rejects(persistPendingOrder('session-a', 'key-one', 'different', snapshot, 17), /CONFLICT/);
    const other = await persistPendingOrder('session-b', 'key-one', 'hash-one', snapshot, 17);
    assert.notEqual(other.id, orders[0].id);

    const first = await persistPendingOrder('session-edit', 'key-a', 'hash-a', snapshot, 1, 'sadad');
    const second = await persistPendingOrder('session-edit', 'key-b', 'hash-b', { ...snapshot, totalMinor: 250 }, 1, 'sadad');
    assert.notEqual(second.id, first.id);
    const { db } = await import('../src/cms/db');
    const rows = (await db.execute({
      sql: 'SELECT id, status, total_minor FROM orders WHERE id IN (?, ?) ORDER BY created_at',
      args: [first.id, second.id],
    })).rows;
    assert.equal(String(rows[0].status), 'cancelled');
    assert.equal(Number(rows[0].total_minor), 100);
    assert.equal(String(rows[1].status), 'placed');
    assert.equal(Number(rows[1].total_minor), 250);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
