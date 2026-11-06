/** After this many failed callback/webhook facts, stop offering another pay attempt. */
export const PAYMENT_FAIL_RETRY_LIMIT = 2;

export type PaymentFailNoticeKind = 'retry' | 'later';

/** Customer-facing copy after Sadad returns a failed pay. Never surface raw gateway text. */
export function paymentFailNoticeKind(failedPaymentCount: number): PaymentFailNoticeKind {
  return failedPaymentCount >= PAYMENT_FAIL_RETRY_LIMIT ? 'later' : 'retry';
}

export function paymentFailCopy(
  kind: PaymentFailNoticeKind,
  text: (en: string, ar: string) => string,
) {
  if (kind === 'later') {
    return {
      title: text('Payment still did not go through', 'ما زال الدفع لم يكتمل'),
      body: text('Please try again later. Your order details are saved.', 'يرجى المحاولة لاحقاً. بيانات طلبك محفوظة.'),
    };
  }
  return {
    title: text('Payment did not go through', 'لم يكتمل الدفع'),
    body: text('Your order is saved. You can try payment again.', 'طلبك محفوظ. يمكنك المحاولة مرة أخرى.'),
  };
}
