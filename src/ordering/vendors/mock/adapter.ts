import type { HostedPaymentGateway } from '@/ordering/payment-gateway/port';
import type { CheckoutIntent, CheckoutLaunch } from '@/ordering/payment-gateway/types';

/**
 * Mock gateway never talks to Sadad. begin returns a local marker; settlement
 * still goes through /mock-pay → settlePayment. verify* always rejects.
 */
export function createMockGateway(): HostedPaymentGateway {
  return {
    name: 'mock',
    begin(intent: CheckoutIntent): Promise<CheckoutLaunch> {
      return Promise.resolve({
        action: `/api/orders/${intent.orderId}/mock-pay`,
        method: 'POST',
        fields: { mode: 'mock' },
      });
    },
    verifyCallback() {
      return Promise.reject(new Error('MOCK_NO_CALLBACK'));
    },
    verifyWebhook() {
      return Promise.reject(new Error('MOCK_NO_WEBHOOK'));
    },
  };
}
