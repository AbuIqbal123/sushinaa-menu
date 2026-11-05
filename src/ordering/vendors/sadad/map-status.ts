import type { PaymentOutcome, PaymentStatus } from '@/ordering/payment-gateway/types';

/** Map Sadad transaction_status codes to our vocabulary. Only place that knows these codes. */
export function fromTransactionStatus(code: number | string | undefined): {
  outcome: PaymentOutcome;
  ourStatus: PaymentStatus;
} {
  const n = typeof code === 'string' ? Number(code) : code;
  if (n === 3) return { outcome: 'paid', ourStatus: 'paid' };
  if (n === 1) return { outcome: 'failed', ourStatus: 'processing' };
  return { outcome: 'failed', ourStatus: 'failed' };
}

export function fromRespCode(code: string | number | undefined): {
  outcome: PaymentOutcome;
  ourStatus: PaymentStatus;
} {
  if (String(code) === '1') return { outcome: 'paid', ourStatus: 'paid' };
  return { outcome: 'failed', ourStatus: 'failed' };
}

export function majorToMinor(amount: string | number | undefined) {
  const n = typeof amount === 'number' ? amount : Number(String(amount ?? '').trim());
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}
