import type { CheckoutIntent, CheckoutLaunch, VerifiedPaymentFact } from './types';

/** Hosted payment as a service. Implementations live under vendors/. */
export interface HostedPaymentGateway {
  readonly name: string;
  begin(intent: CheckoutIntent): Promise<CheckoutLaunch>;
  verifyCallback(raw: unknown): Promise<VerifiedPaymentFact>;
  verifyWebhook(raw: unknown): Promise<VerifiedPaymentFact>;
}
