import { BRANCHES } from '@/branches/branches';

/** Plain sequential ids from before branch-day numbering. */
const PLAIN_BELOW = 100_000;
/** Seven-digit XXDDSEQ numbers from before the month digit was added. */
const DAILY_BELOW = 10_000_000;

/** Ignore older formats when allocating today's sequence. */
export const ORDER_NUMBER_FLOOR = DAILY_BELOW;

export function branchCode(branchId: string) {
  const code = BRANCHES.find((branch) => branch.slug === branchId)?.code;
  if (!code) throw new Error('BRANCH');
  return code;
}

/** Qatar calendar day. The guest number rolls at midnight in Qatar, not at closing. */
export function qatarDay(at: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Qatar',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(at);
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  const start = new Date(`${pick('year')}-${pick('month')}-${pick('day')}T00:00:00+03:00`);
  return { month: pick('month'), day: pick('day'), start, end: new Date(start.getTime() + 86_400_000) };
}

/** XXMMYYABC. Branch 01 is stored without the leading zero; formatOrderNumber puts it back. */
export function composeOrderNumber(branchId: string, month: string, day: string, sequence: number) {
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 999) throw new Error('LIMIT');
  return Number(`${branchCode(branchId)}${month}${day}${String(sequence).padStart(3, '0')}`);
}

export function orderSequence(orderNumber: number) {
  return orderNumber % 1000;
}

export function formatOrderNumber(value: number | string | null | undefined) {
  if (value == null || value === '') return '';
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(n) || n <= 0) return String(value);
  if (n < PLAIN_BELOW) return String(n);
  if (n < DAILY_BELOW) return String(n).padStart(7, '0');
  return String(n).padStart(9, '0');
}
