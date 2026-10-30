// This adapter is deliberately unavailable until Sadad merchant configuration and
// real sandbox fixtures have been verified. No URL/query/browser event can settle an order.
export type PaymentStatus = 'awaiting_payment' | 'pending' | 'paid' | 'failed' | 'cancelled' | 'expired';
export type PaymentAttempt = { id: string; orderId: string; provider: 'sadad'; status: PaymentStatus; reference: string | null; createdAt: string };
export const paymentCapability = { provider: 'sadad', available: false } as const;
export async function beginHostedPayment(_orderId: string): Promise<{ available: false; code: 'PAYMENT_NOT_CONNECTED' }> {
  if (!_orderId) throw new Error('Order reference is required');
  return { available: false, code: 'PAYMENT_NOT_CONNECTED' };
}
