/**
 * Structured payment observability for Vercel runtime logs.
 * One JSON object per line. Never log secrets, signatures, or full PII.
 */
export type PaymentLogLevel = 'info' | 'warn' | 'error';

export type PaymentLogFields = {
  event: string;
  orderId?: string;
  provider?: string;
  outcome?: string;
  reason?: string;
  amountMinor?: number;
  website?: string;
  callbackHost?: string;
  /** Request field names only — never values. */
  fieldNames?: string[];
  httpStatus?: number;
  settled?: boolean;
  /** Presence only — never the hash value. */
  hasChecksum?: boolean;
};

export function paymentLog(level: PaymentLogLevel, fields: PaymentLogFields) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    channel: 'payment',
    ...fields,
  });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.info(line);
}

export function callbackHost(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return 'invalid';
  }
}
