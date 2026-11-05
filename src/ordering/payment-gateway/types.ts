/** Domain payment statuses shared by checkout receipts and the CMS ledger. */
export type PaymentStatus =
  | 'awaiting_payment'
  | 'processing'
  | 'pending'
  | 'paid'
  | 'failed'
  | 'cancelled'
  | 'expired';

/** What we need to start a hosted checkout. No vendor field names. */
export type CheckoutIntent = {
  orderId: string;
  amountMinor: number;
  currency: 'QAR';
  mobileDigits: string;
  language: 'en' | 'ar';
  line: { reference: string; amountMinor: number; quantity: number };
  txnAt: Date;
};

/** Opaque form the browser posts to the hosted gateway. */
export type CheckoutLaunch = {
  action: string;
  method: 'POST';
  fields: Record<string, string>;
};

export type PaymentOutcome = 'paid' | 'failed' | 'cancelled';

/** Normalized fact after cryptographic verify — never vendor wire vocabulary. */
export type VerifiedPaymentFact = {
  orderId: string;
  provider: string;
  reference: string;
  amountMinor: number;
  outcome: PaymentOutcome;
  eventKind: 'callback' | 'webhook';
  ourStatus: PaymentStatus;
};
