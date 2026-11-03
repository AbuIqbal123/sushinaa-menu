import { beginHostedCheckout } from './begin-payment';
import type { PaymentStatus } from '@/ordering/payment-gateway/types';

export type { PaymentStatus };
export type PaymentAttempt = {
  id: string;
  orderId: string;
  provider: 'sadad' | 'mock';
  status: PaymentStatus;
  reference: string | null;
  createdAt: string;
};

/** Start hosted checkout for an awaiting online-pay pickup order. */
export async function beginHostedPayment(orderId: string, session: string | null, language: 'en' | 'ar' = 'en') {
  if (!orderId) throw new Error('Order reference is required');
  return beginHostedCheckout(orderId, session, language);
}
