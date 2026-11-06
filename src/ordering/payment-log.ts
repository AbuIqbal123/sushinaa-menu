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
  /** Sadad callback code. Short text only. */
  RESPCODE?: string;
  /** Sadad callback STATUS. Short text only. */
  STATUS?: string;
  /** Sadad callback message, at most 80 characters. Never a secret or checksum. */
  RESPMSG?: string;
};

function clip(value: string | undefined, max: number) {
  if (!value) return undefined;
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) return undefined;
  return cleaned.length <= max ? cleaned : cleaned.slice(0, max);
}

export function sadadCallbackFields(body: Record<string, string | undefined>) {
  return {
    RESPCODE: clip(body.RESPCODE, 32),
    STATUS: clip(body.STATUS, 32),
    RESPMSG: clip(body.RESPMSG, 80),
  };
}

export function paymentLog(level: PaymentLogLevel, fields: PaymentLogFields) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    channel: 'payment',
    ...fields,
  });
  // eslint allows warn/error only; JSON `level` still carries info|warn|error.
  if (level === 'error') console.error(line);
  else console.warn(line);
}

export function callbackHost(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return 'invalid';
  }
}
