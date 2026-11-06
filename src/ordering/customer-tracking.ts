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

/** Session flag: customer left a paid receipt for the menu; remount must not yank them back. */
export function receiptDismissKey(orderId: string) {
  return `sushinaa-receipt-dismissed:${orderId}`;
}

export function markReceiptDismissed(orderId: string, storage: Pick<Storage, 'setItem'> | null = defaultSessionStorage()) {
  if (!storage) return;
  try { storage.setItem(receiptDismissKey(orderId), '1'); } catch { /* Private mode. */ }
}

export function clearReceiptDismissed(orderId: string, storage: Pick<Storage, 'removeItem'> | null = defaultSessionStorage()) {
  if (!storage) return;
  try { storage.removeItem(receiptDismissKey(orderId)); } catch { /* Private mode. */ }
}

export function isReceiptDismissed(orderId: string, storage: Pick<Storage, 'getItem'> | null = defaultSessionStorage()) {
  if (!storage) return false;
  try { return storage.getItem(receiptDismissKey(orderId)) === '1'; } catch { return false; }
}

function defaultSessionStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null {
  if (typeof sessionStorage === 'undefined') return null;
  return sessionStorage;
}
