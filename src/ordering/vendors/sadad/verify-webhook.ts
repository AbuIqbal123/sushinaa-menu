import type { VerifiedPaymentFact } from '@/ordering/payment-gateway/types';
import type { SadadConfig } from './config';
import { fromTransactionStatus, majorToMinor } from './map-status';
import { sadadSignature, signaturesMatch } from './signature';

function asStringMap(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object') throw new Error('INVALID_WEBHOOK');
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value == null) continue;
    out[key] = typeof value === 'string' ? value : String(value);
  }
  return out;
}

export function verifySadadWebhook(raw: unknown, config: SadadConfig): VerifiedPaymentFact {
  const body = asStringMap(raw);
  const checksum = body.checksumhash;
  if (!checksum) throw new Error('INVALID_WEBHOOK');
  const { checksumhash: _drop, ...rest } = body;
  void _drop;
  const expected = sadadSignature(config.secretKey, rest);
  if (!signaturesMatch(expected, checksum)) throw new Error('INVALID_WEBHOOK');

  const orderId = body.websiteRefNo;
  if (!orderId) throw new Error('INVALID_WEBHOOK');
  const amountMinor = majorToMinor(body.txnAmount);
  if (amountMinor == null) throw new Error('INVALID_WEBHOOK');

  const mapped = fromTransactionStatus(body.transactionStatus);
  // transactionStatus 1 = in progress — treat as non-settling for our ledger
  const outcome = Number(body.transactionStatus) === 1 ? 'failed' as const : mapped.outcome;
  const ourStatus = Number(body.transactionStatus) === 1 ? 'processing' as const : mapped.ourStatus;

  return {
    orderId,
    provider: 'sadad',
    reference: body.transactionNumber || `sadad-webhook:${orderId}`,
    amountMinor,
    outcome: Number(body.transactionStatus) === 3 ? 'paid' : outcome,
    eventKind: 'webhook',
    ourStatus: Number(body.transactionStatus) === 3 ? 'paid' : ourStatus,
  };
}

export const WEBHOOK_ACK = { status: 'success' } as const;
