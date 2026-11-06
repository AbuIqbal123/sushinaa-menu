import { test } from 'node:test';
import assert from 'node:assert/strict';
import { callbackHost, paymentLog, sadadCallbackFields } from '../src/ordering/payment-log';

test('callbackHost extracts host without leaking path', () => {
  assert.equal(callbackHost('https://test-dev-abu-iqbal-projects.vercel.app/api/payments/callback'), 'test-dev-abu-iqbal-projects.vercel.app');
  assert.equal(callbackHost('not-a-url'), 'invalid');
});

test('paymentLog writes a single JSON object with channel payment', () => {
  const lines: string[] = [];
  const original = console.warn;
  console.warn = (msg: string) => { lines.push(String(msg)); };
  try {
    paymentLog('info', { event: 'checkout.launch', orderId: 'SU-1', website: 'example.com' });
  } finally {
    console.warn = original;
  }
  assert.equal(lines.length, 1);
  const parsed = JSON.parse(lines[0]!) as { channel: string; event: string; orderId: string; level: string };
  assert.equal(parsed.channel, 'payment');
  assert.equal(parsed.level, 'info');
  assert.equal(parsed.event, 'checkout.launch');
  assert.equal(parsed.orderId, 'SU-1');
});

test('sadadCallbackFields keeps short gateway text and no other keys', () => {
  const fields = sadadCallbackFields({
    RESPCODE: '2',
    STATUS: ' TXN_FAILURE ',
    RESPMSG: `Card declined ${'x'.repeat(120)}`,
    checksumhash: 'secret-hash',
    secret: 'sadad-secret',
  });
  assert.deepEqual(Object.keys(fields).sort(), ['RESPCODE', 'RESPMSG', 'STATUS']);
  assert.equal(fields.RESPCODE, '2');
  assert.equal(fields.STATUS, 'TXN_FAILURE');
  assert.equal(fields.RESPMSG?.length, 80);
  assert.equal(fields.RESPMSG?.startsWith('Card declined'), true);
  assert.equal(JSON.stringify(fields).includes('secret'), false);
  assert.equal(sadadCallbackFields({ RESPMSG: ' \n\t ' }).RESPMSG, undefined);
});
