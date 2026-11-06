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
  alreadyPaid?: boolean;
  returnKind?: 'paid' | 'failed';
  /** Presence only — never the hash value. */
  hasChecksum?: boolean;
  /** Gateway response code (callback RESPCODE or webhook message). */
  respCode?: string;
  /** Gateway status text or transactionStatus. */
  gatewayStatus?: string;
  /** Gateway message, at most 80 characters. Never a secret or checksum. */
  respMsg?: string;
};

function clip(value: string | undefined, max: number) {
  if (!value) return undefined;
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) return undefined;
  return cleaned.length <= max ? cleaned : cleaned.slice(0, max);
}

/** Safe Sadad browser-callback fields for payment logs. */
export function sadadCallbackFields(body: Record<string, string | undefined>) {
  return {
    respCode: clip(body.RESPCODE, 32),
    gatewayStatus: clip(body.STATUS ?? body.transaction_status, 32),
    respMsg: clip(body.RESPMSG, 80),
  };
}

/** Safe Sadad webhook fields for payment logs. */
export function sadadWebhookFields(body: Record<string, string | undefined>) {
  return {
    gatewayStatus: clip(body.transactionStatus, 32),
    respMsg: clip(body.message, 80),
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
