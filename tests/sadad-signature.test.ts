import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { sadadSignature, signaturesMatch } from '../src/ordering/vendors/sadad/signature';
import { buildSadadLaunch, formatMajorAmount, formatTxnDate } from '../src/ordering/vendors/sadad/begin';
import { fromRespCode, fromTransactionStatus, majorToMinor } from '../src/ordering/vendors/sadad/map-status';
import { verifySadadCallback } from '../src/ordering/vendors/sadad/verify-callback';
import { verifySadadWebhook } from '../src/ordering/vendors/sadad/verify-webhook';
import type { SadadConfig } from '../src/ordering/vendors/sadad/config';

const secret = 'test-secret-key';
const config: SadadConfig = {
  secretKey: secret,
  merchantId: 'm-1',
  publicOrigin: 'https://example.test',
  website: 'example.test',
  callbackUrl: 'https://example.test/api/payments/callback',
};

test('signature is secret + alphabetically sorted field values, excluding productdetail and signature', () => {
  const fields = {
    WEBSITE: 'example.test',
    ORDER_ID: 'SU-1',
    TXN_AMOUNT: '10.00',
    signature: 'should-be-ignored',
    'productdetail[0][amount]': '10.00',
  };
  // Alphabetical keys used: ORDER_ID, TXN_AMOUNT, WEBSITE
  const expected = createHash('sha256')
    .update(secret + 'SU-1' + '10.00' + 'example.test', 'utf8')
    .digest('hex');
  assert.equal(sadadSignature(secret, fields), expected);
  assert.equal(signaturesMatch(expected, expected), true);
  assert.equal(signaturesMatch(expected, expected.slice(0, -1) + '0'), false);
});

test('buildSadadLaunch posts to WebCheckout with optional EMAIL only when present', () => {
  const at = new Date('2026-11-03T12:00:00');
  const without = buildSadadLaunch({
    orderId: 'SU-abc',
    amountMinor: 2550,
    currency: 'QAR',
    mobileDigits: '97455551234',
    language: 'en',
    line: { reference: 'SU-abc', amountMinor: 2550, quantity: 1 },
    txnAt: at,
  }, config);
  assert.equal(without.action, 'https://sadadqa.com/webpurchase');
  assert.equal(without.method, 'POST');
  assert.equal(without.fields.TXN_AMOUNT, '25.50');
  assert.equal(without.fields.EMAIL, undefined);
  assert.ok(without.fields.signature);

  const withEmail = buildSadadLaunch({
    orderId: 'SU-abc',
    amountMinor: 2550,
    currency: 'QAR',
    mobileDigits: '97455551234',
    payerEmail: 'guest@example.com',
    language: 'ar',
    line: { reference: 'SU-abc', amountMinor: 2550, quantity: 1 },
    txnAt: at,
  }, config);
  assert.equal(withEmail.fields.EMAIL, 'guest@example.com');
  assert.equal(withEmail.fields.SADAD_WEBCHECKOUT_PAGE_LANGUAGE, 'arb');
});

test('format helpers stay pure', () => {
  assert.equal(formatMajorAmount(199), '1.99');
  assert.equal(formatTxnDate(new Date(2026, 0, 2, 3, 4, 5)), '2026-01-02 03:04:05');
  assert.equal(majorToMinor('12.34'), 1234);
  assert.equal(fromTransactionStatus(3).outcome, 'paid');
  assert.equal(fromTransactionStatus(1).ourStatus, 'processing');
  assert.equal(fromRespCode('1').outcome, 'paid');
});

test('callback verify accepts a correctly signed paid payload', () => {
  const body: Record<string, string> = {
    ORDERID: 'SU-paid-1',
    TXNAMOUNT: '10.00',
    RESPCODE: '1',
    transaction_number: 'txn-9',
  };
  body.checksumhash = sadadSignature(secret, body);
  const fact = verifySadadCallback(body, config);
  assert.equal(fact.orderId, 'SU-paid-1');
  assert.equal(fact.outcome, 'paid');
  assert.equal(fact.amountMinor, 1000);
  assert.equal(fact.reference, 'txn-9');
});

test('webhook verify rejects a bad checksum and maps status 3 to paid', () => {
  assert.throws(() => verifySadadWebhook({
    websiteRefNo: 'SU-x',
    txnAmount: '5.00',
    transactionStatus: '3',
    checksumhash: 'deadbeef',
  }, config));

  const body: Record<string, string> = {
    websiteRefNo: 'SU-x',
    txnAmount: '5.00',
    transactionStatus: '3',
    transactionNumber: 'w-1',
  };
  body.checksumhash = sadadSignature(secret, body);
  const fact = verifySadadWebhook(body, config);
  assert.equal(fact.outcome, 'paid');
  assert.equal(fact.eventKind, 'webhook');
});
