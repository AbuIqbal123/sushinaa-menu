import type { Lang } from '@/i18n/localize';

const stages = [
  { en: 'Received', ar: 'تم الاستلام' },
  { en: 'Preparing', ar: 'قيد التحضير' },
  { en: 'Ready', ar: 'جاهز' },
];
export function orderPhase(status: string) {
  if (status === 'cancelled' || status === 'refunded') return 'cancelled';
  if (status === 'completed') return 'collected';
  if (status === 'ready') return 'ready';
  if (status === 'accepted' || status === 'preparing') return 'preparing';
  return 'received';
}
export function orderTrackingLabel(status: string, lang: Lang) {
  const phase = orderPhase(status);
  return ({ received: { en: 'Track order', ar: 'تتبّع الطلب' }, preparing: { en: 'Preparing', ar: 'قيد التحضير' },
    ready: { en: 'Order ready', ar: 'جاهز للاستلام' }, collected: { en: 'Order collected', ar: 'تم تسليم الطلب' },
    cancelled: { en: 'Order cancelled', ar: 'تم إلغاء الطلب' } })[phase][lang];
}
export function OrderProgress({ status, lang }: { status: string; lang: Lang }) {
  const phase = orderPhase(status);
  const ar = lang === 'ar';
  const title = ({received: {en:'Order received',ar:'تم استلام طلبك'}, preparing:{en:'Preparing your order',ar:'طلبك قيد التحضير'},
    ready:{en:'Your order is ready',ar:'طلبك جاهز'},collected:{en:'Order collected',ar:'تم تسليم طلبك'},cancelled:{en:'Order cancelled',ar:'تم إلغاء الطلب'}})[phase][lang];
  const description = ({received:{en:'Waiting for the kitchen to begin. Keep this page open for updates.',ar:'بانتظار بدء التحضير في المطبخ. أبقِ هذه الصفحة مفتوحة لمتابعة طلبك.'},
    preparing:{en:'The kitchen is preparing your food. This page will update when it’s ready.',ar:'المطبخ يُحضّر طلبك الآن. ستتحدّث هذه الصفحة عندما يصبح جاهزاً.'},
    ready:{en:'Ready for collection. Please stay in your car. We’ll bring your order to you.',ar:'طلبك جاهز للاستلام. يرجى البقاء في سيارتك، وسنُحضر طلبك إليك.'},

    collected:{en:'Thank you for ordering with Sushinaa.',ar:'شكراً لطلبك من سوشينا.'},
    cancelled:{en:'Please contact your branch if you need help.',ar:'يرجى الاتصال بالفرع إذا احتجت إلى المساعدة.'}})[phase][lang];
  const index = phase === 'ready' || phase === 'collected' ? 2 : phase === 'preparing' ? 1 : 0;
  return <section key={phase} className={`order-progress is-${phase}`} data-status={status} aria-live="polite" aria-atomic="true">
    <div className="order-progress-heading"><span className="order-progress-symbol" aria-hidden="true">
      <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        {phase === 'ready' || phase === 'collected' ? <path className="order-check" pathLength={1} d="m7 16 6 6L25 9"/> : phase === 'cancelled' ? <path d="m9 9 14 14M23 9 9 23"/> : phase === 'preparing' ? <><path d="M5 18h22c-1 7-5 10-11 10S6 25 5 18ZM4 18h24"/><g className="order-steam"><path d="M11 12c-4-4 3-4 0-8M20 12c-4-4 3-4 0-8"/></g></> : <><circle cx="16" cy="16" r="11"/><path d="M16 9v7l5 3"/></>}
      </svg>
    </span><h2>{title}</h2></div>
    <p>{description}</p>
    {phase !== 'cancelled' && phase !== 'collected' && <ol aria-label={ar ? 'حالة الطلب' : 'Order progress'}>{stages.map((stage, i) => <li key={stage.en} className={i <= index ? 'is-reached' : ''} aria-current={i === index ? 'step' : undefined}><span aria-hidden="true">{i < index ? '✓' : i + 1}</span>{stage[lang]}</li>)}</ol>}
  </section>;
}
