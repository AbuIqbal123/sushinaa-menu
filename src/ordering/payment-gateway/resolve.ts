import type { HostedPaymentGateway } from './port';
import { createMockGateway } from '@/ordering/vendors/mock/adapter';
import { createSadadGateway, sadadConfigComplete } from '@/ordering/vendors/sadad';
import { OrderingUnavailable } from '@/ordering/guard';

export type PaymentProviderName = 'mock' | 'counter' | 'sadad';

/**
 * Resolve which payment mode this deployment uses.
 * Pickup ordering stays the product; this only selects how the customer pays.
 */
export function resolvePaymentProvider(): PaymentProviderName {
  const explicit = (process.env.PAYMENT_PROVIDER || '').trim().toLowerCase();
  if (explicit === 'mock') return 'mock';
  if (explicit === 'counter') return 'counter';
  if (explicit === 'sadad') {
    if (!sadadConfigComplete()) throw new OrderingUnavailable();
    return 'sadad';
  }
  if (process.env.VERCEL_ENV === 'production') return 'counter';
  if (sadadConfigComplete()) return 'sadad';
  return 'mock';
}

export function gateway(): HostedPaymentGateway {
  const name = resolvePaymentProvider();
  if (name === 'sadad') return createSadadGateway();
  return createMockGateway();
}
