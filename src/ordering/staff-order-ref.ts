import { formatOrderNumber } from '@/ordering/order-number';

/** Kitchen # first, Sadad txn second — same staff mapping as Coupons / Activity. */
export function staffOrderRef(
  orderNumber: number | null | undefined,
  paymentReference: string | null | undefined,
  fallbackId: string | null | undefined,
  lang: 'en' | 'ar' = 'en',
) {
  const kitchen = orderNumber != null ? `#${formatOrderNumber(orderNumber)}` : null;
  const sadad = paymentReference
    ? `${lang === 'ar' ? 'سداد' : 'Sadad'} ${paymentReference}`
    : null;
  if (kitchen && sadad) return `${kitchen} · ${sadad}`;
  return kitchen ?? sadad ?? fallbackId ?? '—';
}
