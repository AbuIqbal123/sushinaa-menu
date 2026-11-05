import { test } from 'node:test';
import assert from 'node:assert/strict';
import { callbackHost, paymentLog } from '../src/ordering/payment-log';

test('callbackHost extracts host without leaking path', () => {
  assert.equal(callbackHost('https://test-dev-abu-iqbal-projects.vercel.app/api/payments/callback'), 'test-dev-abu-iqbal-projects.vercel.app');
  assert.equal(callbackHost('not-a-url'), 'invalid');
});

test('paymentLog writes a single JSON object with channel payment', () => {
  const lines: string[] = [];
  const original = console.info;
  console.info = (msg: string) => { lines.push(String(msg)); };
  try {
    paymentLog('info', { event: 'checkout.launch', orderId: 'SU-1', website: 'example.com' });
  } finally {
    console.info = original;
  }
  assert.equal(lines.length, 1);
  const parsed = JSON.parse(lines[0]!) as { channel: string; event: string; orderId: string };
  assert.equal(parsed.channel, 'payment');
  assert.equal(parsed.event, 'checkout.launch');
  assert.equal(parsed.orderId, 'SU-1');
});
