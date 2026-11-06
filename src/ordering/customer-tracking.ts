/** How long a collected / cancelled / refunded order may keep reclaiming the customer UI. */
export const CUSTOMER_RECEIPT_TTL_MS = 4 * 60 * 60 * 1000;

const TERMINAL = new Set(['completed', 'cancelled', 'refunded']);

export function isTerminalCustomerStatus(status: string) {
  return TERMINAL.has(status);
}

/** Live and recently finished orders reopen the receipt; older finished ones must not. */
export function shouldResumeCustomerReceipt(
  order: { status: string; updatedAt?: string | null },
  now = Date.now(),
) {
  if (!isTerminalCustomerStatus(order.status)) return true;
  const at = order.updatedAt ? Date.parse(order.updatedAt) : Number.NaN;
  if (!Number.isFinite(at)) return false;
  return now - at < CUSTOMER_RECEIPT_TTL_MS;
}
