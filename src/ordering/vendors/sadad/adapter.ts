import type { HostedPaymentGateway } from '@/ordering/payment-gateway/port';
import type { CheckoutIntent, CheckoutLaunch, VerifiedPaymentFact } from '@/ordering/payment-gateway/types';
import { buildSadadLaunch } from './begin';
import { loadSadadConfig, type SadadConfig } from './config';
import { verifySadadCallback } from './verify-callback';
import { verifySadadWebhook } from './verify-webhook';

export function createSadadGateway(config: SadadConfig = loadSadadConfig()): HostedPaymentGateway {
  return {
    name: 'sadad',
    begin(intent: CheckoutIntent): Promise<CheckoutLaunch> {
      return Promise.resolve(buildSadadLaunch(intent, config));
    },
    verifyCallback(raw: unknown): Promise<VerifiedPaymentFact> {
      return Promise.resolve(verifySadadCallback(raw, config));
    },
    verifyWebhook(raw: unknown): Promise<VerifiedPaymentFact> {
      return Promise.resolve(verifySadadWebhook(raw, config));
    },
  };
}
