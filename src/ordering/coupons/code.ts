import { randomInt } from 'node:crypto';
import { CouponError } from './types';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const MANUAL = /^[A-Z0-9]{4,16}$/;

export function normalizeCode(raw: string): string {
  return raw.replace(/[\s-]+/g, '').toUpperCase();
}

export function validateManualCode(raw: string): string {
  const code = normalizeCode(raw);
  if (!MANUAL.test(code)) throw new CouponError('INVALID_CODE');
  return code;
}

export function generateCode(): string {
  let body = '';
  for (let i = 0; i < 8; i++) body += ALPHABET[randomInt(ALPHABET.length)];
  return `${body.slice(0, 4)}-${body.slice(4)}`;
}
