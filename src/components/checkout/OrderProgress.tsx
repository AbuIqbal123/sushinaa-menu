import type { Lang } from '@/i18n/localize';

const stages = [
  { en: 'Received', ar: 'تم الاستلام' },
  { en: 'Preparing', ar: 'قيد التحضير' },
  { en: 'Ready', ar: 'جاهز' },
];

export function OrderProgress({ status, lang }: { status: string; lang: Lang }) {
  const ar = lang === 'ar';
  const cancelled = status === 'cancelled' || status === 'refunded';
  const collected = status === 'completed';
  const ready = status === 'ready';
  const preparing = status === 'accepted' || status === 'preparing';
  const index = ready || collected ? 2 : preparing ? 1 : 0;
  const title = cancelled ? (ar ? 'تم إلغاء الطلب' : 'Order cancelled')
    : collected ? (ar ? 'تم تسليم طلبك' : 'Order collected')
    : ready ? (ar ? 'طلبك جاهز' : 'Your order is ready')
    : preparing ? (ar ? 'طلبك قيد التحضير' : 'Your order is being prepared')
    : (ar ? 'تم استلام طلبك' : 'Your order has been received');
  const symbol = cancelled ? '×' : ready || collected ? '✓' : '';
  return <section className={`order-progress${ready ? ' is-ready' : ''}${cancelled ? ' is-cancelled' : ''}`} data-status={status} aria-live="polite" aria-atomic="true">
    <div className="order-progress-heading">{symbol && <span className="order-progress-symbol" aria-hidden="true">{symbol}</span>}<h2>{title}</h2></div>
    {ready && <p>{ar ? 'يرجى البقاء في سيارتك. سنُحضر طلبك إليك.' : 'Please stay in your car. We’ll bring your order to you.'}</p>}
    {!cancelled && !collected && <ol aria-label={ar ? 'حالة الطلب' : 'Order progress'}>{stages.map((stage, i) => <li key={stage.en} className={i <= index ? 'is-reached' : ''} aria-current={i === index ? 'step' : undefined}><span aria-hidden="true" />{stage[lang]}</li>)}</ol>}
  </section>;
}
