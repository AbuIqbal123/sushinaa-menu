import type { VerifiedPaymentFact } from '@/ordering/payment-gateway/types';
import type { SadadConfig } from './config';
import { fromRespCode, fromTransactionStatus, majorToMinor } from './map-status';
import { sadadSignature, signaturesMatch } from './signature';

function asRecord(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object') throw new Error('INVALID_CALLBACK');
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value == null) continue;
    out[key] = typeof value === 'string' ? value : String(value);
  }
  return out;
}

export function verifySadadCallback(raw: unknown, config: SadadConfig): VerifiedPaymentFact {
  const body = asRecord(raw);
  const checksum = body.checksumhash;
  if (!checksum) throw new Error('INVALID_CALLBACK');
  const { checksumhash: _drop, ...rest } = body;
  void _drop;
  const expected = sadadSignature(config.secretKey, rest);
  if (!signaturesMatch(expected, checksum)) throw new Error('INVALID_CALLBACK');

  const orderId = body.ORDERID || body.website_ref_no;
  if (!orderId) throw new Error('INVALID_CALLBACK');
  const amountMinor = majorToMinor(body.TXNAMOUNT);
  if (amountMinor == null) throw new Error('INVALID_CALLBACK');

  const mapped = body.transaction_status != null
    ? fromTransactionStatus(body.transaction_status)
    : fromRespCode(body.RESPCODE);

  return {
    orderId,
    provider: 'sadad',
    reference: body.transaction_number || `sadad-callback:${orderId}`,
    amountMinor,
    outcome: mapped.outcome,
    eventKind: 'callback',
    ourStatus: mapped.ourStatus,
  };
}
