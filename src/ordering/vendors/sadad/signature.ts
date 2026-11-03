import { createHash } from 'node:crypto';

/**
 * Sadad WebCheckout signature: secret + alphabetically sorted field values
 * (excluding productdetail / signature / checksumhash), SHA-256 hex.
 * Pure: no env, no I/O.
 */
export function sadadSignature(secretKey: string, fields: Record<string, string>) {
  const skip = new Set(['productdetail', 'signature', 'checksumhash']);
  const keys = Object.keys(fields)
    .filter((key) => !skip.has(key) && !key.startsWith('productdetail'))
    .sort();
  const plain = secretKey + keys.map((key) => fields[key]).join('');
  return createHash('sha256').update(plain, 'utf8').digest('hex');
}

export function signaturesMatch(expected: string, actual: string) {
  if (!expected || !actual || expected.length !== actual.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ actual.charCodeAt(i);
  return diff === 0;
}
