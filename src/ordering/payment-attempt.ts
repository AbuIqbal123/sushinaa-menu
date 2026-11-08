import type { SqlStatement } from '@/cms/sql';
import type { PaymentStatus } from './payment-gateway/types';

export const attemptStatuses = [
  'awaiting_payment',
  'processing',
  'paid',
  'failed',
  'cancelled',
] as const;

export type AttemptStatus = (typeof attemptStatuses)[number];

export const sealedAttemptStatuses = ['paid', 'failed', 'cancelled'] as const;

const next: Record<AttemptStatus, readonly AttemptStatus[]> = {
  awaiting_payment: ['processing', 'paid', 'failed', 'cancelled'],
  processing: ['paid', 'failed', 'cancelled', 'processing'],
  paid: [],
  failed: ['awaiting_payment', 'processing', 'paid', 'cancelled'],
  cancelled: [],
};

export function isAttemptStatus(value: string): value is AttemptStatus {
  return (attemptStatuses as readonly string[]).includes(value);
}

export function canAttemptTransition(from: AttemptStatus, to: AttemptStatus) {
  return next[from].includes(to);
}

/** Statuses that may legally move to `to` per the attempt graph. */
export function fromStatusesFor(to: AttemptStatus): readonly AttemptStatus[] {
  return attemptStatuses.filter((from) => canAttemptTransition(from, to));
}

export function attemptFromPredicate(to: AttemptStatus) {
  const from = fromStatusesFor(to);
  if (!from.length) return '0';
  return `status IN (${from.map((status) => `'${status}'`).join(',')})`;
}

export function openAttemptPredicate() {
  return `status NOT IN (${sealedAttemptStatuses.map((status) => `'${status}'`).join(',')})`;
}

export function cancelOpenAttemptsStatement(orderId: string, at: string): SqlStatement {
  return {
    sql: `UPDATE payment_attempts SET status='cancelled', updated_at=?
      WHERE order_id=? AND ${openAttemptPredicate()}`,
    args: [at, orderId],
  };
}

/** Settle path: mark the attempt paid after the order row settles (caller gates with changes()). */
export function markAttemptPaidForProviderStatement(
  orderId: string,
  provider: string,
  at: string,
  reference: string | null,
): SqlStatement {
  return {
    sql: `UPDATE payment_attempts SET status='paid', updated_at=?, reference=COALESCE(reference, ?)
      WHERE order_id=? AND provider=? AND changes()=1 AND ${attemptFromPredicate('paid')}`,
    args: [at, reference, orderId, provider],
  };
}

export function markAttemptPaidStatement(orderId: string, at: string): SqlStatement {
  return {
    sql: `UPDATE payment_attempts SET status='paid', updated_at=?
      WHERE order_id=? AND changes()=1 AND ${attemptFromPredicate('paid')}`,
    args: [at, orderId],
  };
}

export function insertAwaitingAttemptStatement(
  id: string,
  orderId: string,
  provider: 'sadad' | 'mock',
  at: string,
): SqlStatement {
  return {
    sql: `INSERT INTO payment_attempts (id,order_id,provider,status,created_at,updated_at)
      VALUES (?,?,?,'awaiting_payment',?,?)`,
    args: [id, orderId, provider, at, at],
  };
}

export function deriveCustomerPaymentStatus(input: {
  paidAt: unknown;
  paymentMethod: string;
  createdAt: string;
  nowMs?: number;
}): PaymentStatus {
  if (input.paidAt) return 'paid';
  if (input.paymentMethod === 'pay_at_pickup') return 'pending';
  const created = Date.parse(input.createdAt);
  const now = input.nowMs ?? Date.now();
  if (Number.isFinite(created) && created + 30 * 60_000 <= now) return 'expired';
  return 'awaiting_payment';
}

export function attemptStatusCoalesceSql() {
  return `COALESCE(a.status, CASE WHEN o.paid_at IS NOT NULL THEN 'paid' ELSE 'awaiting_payment' END)`;
}
