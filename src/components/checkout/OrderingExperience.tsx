'use client';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MenuFeed } from '@/components/menu/MenuFeed';
import { DishDetailSheet } from '@/components/menu/DishDetailSheet';
import { CartProvider, useCart, type CartLine } from '@/ordering/cart';
import { useMenu } from '@/cms/context';
import { LangButton, useLocale, useSetSheetOpen } from '@/i18n/locale';
import { branches, branchStatus, timeLabel, type BranchId } from '@/ordering/checkout/branches';
import { customerSchema, type Customer } from '@/ordering/checkout/validation';
import { imageFor, photoPosition } from '@/ordering/price';
import type { PaymentStatus } from '@/ordering/checkout/payment';

const emptyCustomer: Customer = { name: '', phone: '', plate: '', colour: '', car: '', instructions: '' };
type Step = 'branches' | 'menu' | 'basket' | 'details' | 'review' | 'payment';
type Receipt = { id: string; paymentStatus: PaymentStatus; totalMinor: number };
export function OrderingExperience({ initialNow }: { initialNow: string }) {
  return <CartProvider storageKey="sushinaa-curbside-basket-v1"><Experience initialNow={initialNow} /></CartProvider>;
}
function Experience({ initialNow }: { initialNow: string }) {
  const { lang, t } = useLocale();
  const text = (en: string, ar: string) => lang === 'ar' ? ar : en;
  const menu = useMenu();
  const router = useRouter();
  const cart = useCart();
  const [step, setStep] = useState<Step>('branches');
  const [branchId, setBranchId] = useState<BranchId | null>(null);
  const [returnStep, setReturnStep] = useState<Step>('menu');
  const [now, setNow] = useState(() => new Date(initialNow));
  const [customer, setCustomer] = useState<Customer>(emptyCustomer);
  const [errors, setErrors] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const attempt = useRef<{ body: string; key: string } | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [editing, setEditing] = useState<CartLine | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(step);
  const setSheetOpen = useSetSheetOpen();
  useEffect(() => {
    if (!editing) return;
    setSheetOpen(true);
    return () => setSheetOpen(false);
  }, [editing, setSheetOpen]);
  const branch = branches.find(b => b.id === branchId);
  const status = branch ? branchStatus(branch, now) : null;
  const money = (minor: number) => `${new Intl.NumberFormat(lang === 'ar' ? 'ar-QA' : 'en-QA', { maximumFractionDigits: 2 }).format(minor / 100)} ${text('QAR', 'ر.ق')}`;
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 15000);
    void fetch('/api/orders').catch(() => {});
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (previousStep.current !== step) heading.current?.focus();
    previousStep.current = step;
  }, [step]);
  function go(next: Step) { setError(''); setStep(next); }
  function changeBranch() { setReturnStep(step === 'branches' ? 'menu' : step === 'payment' ? 'review' : step); go('branches'); }
  function choose(id: BranchId) { setBranchId(id); setReceipt(null); go(returnStep); }
  function validateDetails(event: React.FormEvent) {
    event.preventDefault();
    const result = customerSchema.safeParse(customer);
    if (!result.success) {
      const fields = result.error.issues.map(i => String(i.path[0])); setErrors(fields);
      document.getElementById(`collection-${fields[0]}`)?.focus(); return;
    }
    setErrors([]); setCustomer(result.data); go('review');
  }
  const errorMessage = (code: string) => ({
    CLOSED: text('This branch has closed. Your basket is saved. Choose an open branch to continue.', 'هذا الفرع مغلق الآن. سلتك محفوظة. اختر فرعاً مفتوحاً للمتابعة.'),
    PRICE_CHANGED: text('A price has changed. Refresh the menu and review your basket before continuing.', 'تغيّر أحد الأسعار. حدّث القائمة وراجع سلتك قبل المتابعة.'),
    UNAVAILABLE: text('An item is no longer available. Refresh the menu to update your basket.', 'أحد الأصناف لم يعد متوفراً. حدّث القائمة لتحديث سلتك.'),
    OPTIONS: text('Some choices have changed. Refresh the menu and edit the affected item.', 'تغيّرت بعض الخيارات. حدّث القائمة وعدّل الصنف.'),
    LIMIT: text('The order limit was reached. Reduce the quantity or try again later.', 'تم الوصول إلى الحد المسموح. قلّل الكمية أو حاول لاحقاً.'),
    CONFLICT: text('This checkout attempt has changed. Return to review and try again.', 'تغيّرت محاولة الدفع هذه. عُد للمراجعة وحاول مجدداً.'),
    ORDERING_UNAVAILABLE: text('Ordering is not connected in this preview. Your basket is still here.', 'الطلب غير متصل في هذه المعاينة. سلتك ما زالت محفوظة.'),
  }[code] ?? text('We couldn’t continue. Check your connection and try again. Your details are still here.', 'تعذّرت المتابعة. تحقق من الاتصال وحاول مجدداً. بياناتك ما زالت محفوظة.'));
  async function checkout() {
    if (busyRef.current || !branch || !cart.lines.length || cart.unavailableCount > 0) return;
    busyRef.current = true; setBusy(true); setError('');
    try {
      const body = JSON.stringify({ branchId, customer, lines: cart.lines.map(line => ({ dishId: line.dish.id, selection: line.sel, quantity: line.qty, note: line.note, expectedUnitMinor: Math.round(line.unitQar * 100) })) });
      if (attempt.current?.body !== body) {
        // crypto.randomUUID is unavailable on an HTTP LAN preview; getRandomValues works there.
        const bytes = crypto.getRandomValues(new Uint8Array(20));
        attempt.current = { body, key: Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('') };
      }
      const res = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': attempt.current.key }, body });
      const data = await res.json();
      if (!res.ok) { setError(errorMessage(data.code)); return; }
      setReceipt(data); go('payment');
    } catch { setError(errorMessage('NETWORK')); }
    finally { setBusy(false); busyRef.current = false; }
  }
  const branchName = branch ? text(branch.name, branch.nameAr) : '';
  const branchControl = <button type="button" onClick={changeBranch} className="collection-switch">
    <CarIcon /><span>{text('Car collection', 'استلام عند السيارة')} <strong>{branchName}</strong></span>
    <span className={status?.open ? 'status-dot open' : 'status-dot'} />
    <span className="collection-change">{text('Change', 'تغيير')}</span>
  </button>;
  if (step === 'menu' && branch) return <div className="app-lock"><MenuFeed onReview={() => go('basket')} branchBar={branchControl} /></div>;
  const title = step === 'branches' ? text('Good food.\nYour nearest branch.', 'مذاق تحبّه.\nمن أقرب فرع.')
    : step === 'basket' ? text('Your favourites,\nyour way.', 'أصنافك المفضلة،\nعلى ذوقك.')
    : step === 'details' ? text('We’ll find you\nat your car.', 'نصل إليك\nعند سيارتك.')
    : step === 'review' ? text('One last look.', 'مراجعة أخيرة.') : text('Your payment', 'الدفع');
  const count = cart.itemCount;
  const closedNotice = status && !status.open ? <div className="checkout-notice" role="status"><strong>{text('This branch is currently closed', 'هذا الفرع مغلق حالياً')}</strong><p>{text('Browse and save your favourites, or choose an open branch to continue.', 'تصفح واحفظ أصنافك المفضلة، أو اختر فرعاً مفتوحاً للمتابعة.')}</p><button type="button" className="text-action" onClick={changeBranch}>{text('Choose another branch', 'اختر فرعاً آخر')}</button></div> : null;
  const total = <div className="checkout-total"><span>{text('Total', 'الإجمالي')}</span><strong>{money(Math.round(cart.totalQar * 100))}</strong></div>;
  function basketLines(editable: boolean) {
    return <ul className="checkout-lines">{cart.lines.map(line => {
      const photo = imageFor(line.dish, line.sel);
      return <li key={line.key}>
        <Image src={photo} alt="" width={64} height={76} unoptimized style={{ objectPosition: photoPosition(line.dish, photo) }} />
        <div className="checkout-line-info"><strong>{line.displayName}</strong><p>{line.meta}</p>{line.note && <p className="checkout-note">“{line.note}”</p>}
          <span className="checkout-line-price">{line.qty} × {money(Math.round(line.unitQar * 100))}</span>
          {editable && <button type="button" className="text-action" onClick={() => setEditing(line)}>{text('Edit choices & notes', 'تعديل الخيارات والملاحظات')}</button>}
        </div>
        {editable ? <div className="checkout-quantity"><button type="button" onClick={() => cart.dec(line.key)} aria-label={t.fewerOf(line.displayName)}>−</button><span>{line.qty}</span><button type="button" onClick={() => cart.inc(line.key)} disabled={line.qty >= 20} aria-label={t.moreOf(line.displayName)}>+</button></div> : <strong className="checkout-line-sum">{money(Math.round(line.lineTotal * 100))}</strong>}
      </li>;
    })}</ul>;
  }
  const stepNumber = step === 'basket' ? 1 : step === 'details' ? 2 : 3;
  return <div className="ordering-page" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
    <div className="ordering-content" inert={Boolean(editing)}>
      <header className="ordering-header"><Link href="/" aria-label={text('View-only menu', 'قائمة التصفح')}><Image src={menu.settings.logo} width={59} height={55} alt={t.brand} unoptimized /></Link><span className="collection-label"><CarIcon />{text('Car collection', 'استلام عند السيارة')}</span><LangButton /></header>
      {step === 'branches' ? <>
        <main id="main" className="branch-page">
          <div className="branch-intro"><span className="eyebrow">{text('SUSHINAA · MADE FOR YOU', 'سوشينا · على ذوقك')}</span><h1 ref={heading} tabIndex={-1}>{title}</h1><p>{text('Choose where you’ll collect. We’ll bring your order to your car.', 'اختر فرع الاستلام. نُحضر طلبك إلى سيارتك.')}</p></div>
          <div className="branch-list" aria-label={text('Choose your branch', 'اختر فرعك')}>
            {branches.map((b, i) => { const s = branchStatus(b, now); return <button type="button" className={`branch-card${branchId === b.id ? ' selected' : ''}`} key={b.id} onClick={() => choose(b.id)}>
              <span className="branch-index">0{i + 1}</span><span className="branch-card-content"><span className="branch-card-heading"><strong>{text(b.name, b.nameAr)}</strong><span className={`branch-status${s.open ? ' is-open' : ''}`}><i />{s.open ? text('Open', 'مفتوح') : text('Closed', 'مغلق')}</span></span><span className="branch-hours" dir="ltr"><bdi dir="ltr">{timeLabel(s.hours[0], lang)}</bdi> – <bdi dir="ltr">{timeLabel(s.hours[1], lang)}</bdi></span><span className="branch-card-detail">{s.open ? text('Collection available', 'الاستلام متاح') : text('Browse the menu', 'تصفح القائمة')}{s.hours[1] > 1440 ? text(' · closes after midnight', ' · يغلق بعد منتصف الليل') : ''}</span></span><span className="branch-arrow" aria-hidden="true">↗</span>
            </button>; })}
          </div>
          <p className="branch-timezone">{text('Opening hours are in Qatar time.', 'ساعات العمل بتوقيت قطر.')}</p>
          <div className="collection-footer-art"><span>巻</span><p>{text('A little ritual.\nA lot of flavour.', 'لحظات بسيطة.\nنكهات استثنائية.')}</p><span className="footer-rule" /></div>
          <Link className="view-menu-link" href="/">{text('Just exploring? View the menu', 'تستكشف فقط؟ تصفح القائمة')}</Link>
        </main>
      </> : <>
        <div className="checkout-navigation"><button type="button" className="text-action" disabled={busy} onClick={() => go(step === 'basket' ? 'menu' : step === 'details' ? 'basket' : step === 'review' ? 'details' : 'review')}><span className="back-arrow" aria-hidden="true">←</span> {text('Back', 'رجوع')}</button><span>{text('YOUR COLLECTION', 'طلب الاستلام')}</span></div>
        <main id="main" className="checkout-main">
          <ol className="checkout-progress" aria-label={text('Checkout steps', 'خطوات الطلب')}>{[text('Basket', 'السلة'), text('Details', 'البيانات'), text('Review', 'المراجعة')].map((label, i) => <li key={label} className={stepNumber >= i + 1 ? 'active' : ''} aria-current={stepNumber === i + 1 ? 'step' : undefined}><span>{i + 1}</span>{label}</li>)}</ol>
          <h1 ref={heading} tabIndex={-1}>{title}</h1>
          {branchControl}
          {step !== 'payment' && closedNotice}
          {cart.unavailableCount > 0 && <div className="checkout-notice" role="alert"><strong>{text('Your basket needs an update', 'تحتاج سلتك إلى تحديث')}</strong><p>{text(`${cart.unavailableCount} serving(s) or their choices are no longer available. Remove them before continuing.`, `${cart.unavailableCount} حصة أو خياراتها لم تعد متوفرة. احذفها قبل المتابعة.`)}</p><button type="button" className="text-action" onClick={cart.discardUnavailable}>{text('Remove unavailable selections', 'حذف الخيارات غير المتوفرة')}</button></div>}
          {step === 'basket' && <>
            {count ? <><div className="section-caption">{text(`${count} ${count === 1 ? "serving" : "servings"} · individually yours`, `${count} حصص · حسب رغبتك`)}</div>{basketLines(true)}<button type="button" className="text-action add-more" onClick={() => go('menu')}>+ {text('Add something else', 'أضف صنفاً آخر')}</button>{total}<button type="button" className="checkout-primary" disabled={!status?.open || cart.unavailableCount > 0} onClick={() => go('details')}>{text('Collection details', 'بيانات الاستلام')}<Forward /></button></> : <div className="empty-basket"><CarIcon /><h2>{text('Something delicious awaits.', 'أصناف لذيذة بانتظارك.')}</h2><p>{text('Choose your favourites and make each serving your own.', 'اختر أصنافك المفضلة وخصص كل حصة على ذوقك.')}</p><button type="button" className="checkout-primary" onClick={() => go('menu')}>{text('Explore the menu', 'تصفح القائمة')}<Forward /></button></div>}
          </>}
          {step === 'details' && <form onSubmit={validateDetails} noValidate>
            <p className="checkout-intro">{text('A few details so our team can recognise your car and contact you about collection.', 'بعض البيانات لمساعدة فريقنا في التعرف على سيارتك والتواصل معك بشأن الاستلام.')}</p>
            <div className="checkout-fields">{(['name', 'phone', 'plate', 'colour', 'car', 'instructions'] as const).map(key => {
              const label = { name: text('Your name', 'اسمك'), phone: text('Mobile number', 'رقم الجوال'), plate: text('Qatar plate number', 'رقم اللوحة القطرية'), colour: text('Car colour', 'لون السيارة'), car: text('Make / model', 'نوع / طراز السيارة'), instructions: text('Collection instructions', 'تعليمات الاستلام') }[key];
              const required = ['name', 'phone', 'plate'].includes(key);
              const hint = key === 'phone' ? text('Qatar mobile · +974 and 8 digits', 'جوال قطري · ‎+974 و٨ أرقام') : key === 'plate' ? text('As shown on your plate, including any letters.', 'كما يظهر على اللوحة، بما في ذلك الحروف إن وجدت.') : '';
              const invalid = errors.includes(key);
              return <label key={key} className={`checkout-field field-${key}`} htmlFor={`collection-${key}`}><span>{label}{!required && <small>{text('Optional', 'اختياري')}</small>}</span>
                {key === 'instructions' ? <textarea id={`collection-${key}`} value={customer[key]} maxLength={400} rows={3} onChange={e => setCustomer({ ...customer, [key]: e.target.value })} /> : <input id={`collection-${key}`} type={key === 'phone' ? 'tel' : 'text'} inputMode={key === 'phone' ? 'tel' : 'text'} autoComplete={key === 'name' ? 'name' : key === 'phone' ? 'tel' : 'off'} dir={key === 'phone' ? 'ltr' : undefined} required={required} maxLength={key === 'name' ? 100 : key === 'phone' ? 30 : key === 'plate' ? 24 : key === 'colour' ? 50 : 80} value={customer[key]} aria-invalid={invalid} aria-describedby={hint || invalid ? `hint-${key}` : undefined} onChange={e => { setCustomer({ ...customer, [key]: e.target.value }); setErrors(errors.filter(x => x !== key)); }} />}
                {(hint || invalid) && <small id={`hint-${key}`} className={invalid ? 'field-error' : 'field-hint'}>{invalid ? (key === 'phone' ? text('Enter a valid Qatar mobile number.', 'أدخل رقم جوال قطرياً صالحاً.') : key === 'plate' ? text('Enter your plate number, with any letters.', 'أدخل رقم لوحتك مع الحروف إن وجدت.') : text('Please enter your name.', 'يرجى إدخال اسمك.')) : hint}</small>}
              </label>;
            })}</div>
            <p className="checkout-privacy">{text('Used for this collection. No account needed.', 'تُستخدم لهذه العملية. لا حاجة لإنشاء حساب.')}</p>
            <button type="submit" className="checkout-primary" disabled={!status?.open || !count || cart.unavailableCount > 0}>{text('Review my order', 'مراجعة طلبي')}<Forward /></button>
          </form>}
          {step === 'review' && <>
            <section className="review-details"><div className="review-section-title"><h2>{text('At your car', 'عند سيارتك')}</h2><button type="button" className="text-action" onClick={() => go('details')}>{text('Edit', 'تعديل')}</button></div><strong>{customer.name}</strong><p dir="ltr" className="review-phone">+{customer.phone}</p><div className="plate-card"><span>{text('QATAR', 'قطر')}</span><strong dir="auto">{customer.plate}</strong></div><p>{[customer.colour, customer.car].filter(Boolean).join(' · ')}</p>{customer.instructions && <p className="checkout-note">{customer.instructions}</p>}</section>
            <div className="review-section-title"><h2>{text('Your order', 'طلبك')}</h2><button type="button" className="text-action" onClick={() => go('basket')}>{text('Edit', 'تعديل')}</button></div>{basketLines(false)}{total}
            <div className="checkout-notice payment-preview"><strong>{text('Preview · payments not connected', 'معاينة · الدفع غير متصل')}</strong><p>{text('You can review the handoff. No payment will be taken and this order will not reach the kitchen.', 'يمكنك معاينة خطوة الدفع. لن يتم خصم أي مبلغ أو إرسال الطلب إلى المطبخ.')}</p></div>
            <button type="button" className="checkout-primary" disabled={busy || !status?.open || !count || cart.unavailableCount > 0} onClick={checkout}>{busy ? text('Checking your order…', 'جارٍ التحقق من الطلب…') : text('Continue to payment', 'المتابعة إلى الدفع')}<Forward /></button>
            <p className="checkout-privacy">{text('Secure payment will be hosted by Sadad.', 'ستتم عملية الدفع الآمن عبر سداد.')}</p>
          </>}
          {step === 'payment' && receipt && <PaymentPanel receipt={receipt} money={money} text={text} onBack={() => go('review')} />}
          {error && <div className="checkout-error" role="alert"><p>{error}</p><button className="text-action" type="button" onClick={() => { go('basket'); router.refresh(); }}>{text('Refresh menu', 'تحديث القائمة')}</button></div>}
        </main>
      </>}
      <footer className="ordering-footer"><span>SUSHINAA</span><span>{text('Private ordering preview', 'معاينة خاصة للطلب')}</span></footer>
    </div>
    {editing && <DishDetailSheet dish={editing.dish} ordering initialEntries={Array.from({ length: editing.qty }, () => ({ sel: editing.sel, note: editing.note }))} onSave={entries => cart.replace(editing.key, entries)} onClose={() => setEditing(null)} />}
  </div>;
}
function PaymentPanel({ receipt, money, text, onBack }: { receipt: Receipt; money: (n: number) => string; text: (en: string, ar: string) => string; onBack: () => void }) {
  const content: Record<PaymentStatus, [string, string, string, string]> = {
    awaiting_payment: ['Ready for the next step.', 'جاهز للخطوة التالية.', 'Your preview order is saved. Sadad is not connected yet. Nothing has been charged or sent to the kitchen.', 'تم حفظ طلب المعاينة. سداد غير متصل بعد. لم يتم خصم أي مبلغ أو إرسال الطلب إلى المطبخ.'],
    pending: ['Waiting for confirmation', 'بانتظار التأكيد', 'We are waiting for payment confirmation. Please don’t pay again.', 'ننتظر تأكيد الدفع. يرجى عدم تكرار الدفع.'],
    paid: ['Payment confirmed', 'تم تأكيد الدفع', 'Your payment is confirmed. Keep your order reference for collection.', 'تم تأكيد الدفع. احتفظ بمرجع الطلب للاستلام.'],
    failed: ['Payment wasn’t completed', 'لم يكتمل الدفع', 'Your basket is saved. Review your order before trying again.', 'سلتك محفوظة. راجع طلبك قبل المحاولة مجدداً.'],
    cancelled: ['Payment cancelled', 'تم إلغاء الدفع', 'Your basket is saved if you’d like to return.', 'سلتك محفوظة إذا أردت العودة.'],
    expired: ['This payment session expired', 'انتهت جلسة الدفع', 'Return to your basket to check availability and current prices.', 'عُد إلى السلة للتحقق من التوفر والأسعار الحالية.'],
  };
  const c = content[receipt.paymentStatus] ?? content.pending;
  return <section className="payment-state" aria-live="polite"><div className="payment-emblem"><CarIcon /></div><span className="eyebrow">{text('ORDER PREVIEW', 'معاينة الطلب')}</span><h2>{text(c[0], c[1])}</h2><p>{text(c[2], c[3])}</p><div className="payment-reference"><span>{text('Reference', 'المرجع')}</span><strong dir="ltr">{receipt.id}</strong><span>{text('Total', 'الإجمالي')}</span><b>{money(receipt.totalMinor)}</b></div><button type="button" className="checkout-primary" onClick={onBack}>{text('Back to review', 'العودة للمراجعة')}<Forward /></button></section>;
}
function Forward() { return <span className="forward-arrow" aria-hidden="true">→</span>; }
function CarIcon() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m5 9 2-5h10l2 5M4 9h16a1 1 0 0 1 1 1v7H3v-7a1 1 0 0 1 1-1ZM5 17v3m14-3v3M6 13h2m8 0h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
