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
import { BRANCHES as branches, type BranchId } from '@/branches/branches';
import { branchStatus, qatarClock } from '@/branches/hours';
import { customerSchema, digits, type Customer } from '@/ordering/checkout/validation';
import { formatQar } from '@/lib/money';
import type { PaymentStatus } from '@/ordering/checkout/payment';
import { MockSadadGateway } from './MockSadadGateway';
import { BranchMap } from './BranchMap';
import { CollectionNotice } from '@/components/site/CollectionNotice';

const emptyCustomer: Customer = { name: '', phone: '', plate: 'Q', colour: '', car: '', instructions: '' };
type Step = 'branches' | 'menu' | 'basket' | 'details' | 'review' | 'payment' | 'receipt';
type Receipt = { id: string; paymentStatus: PaymentStatus; totalMinor: number; paymentMethod: 'mock' | 'pay_at_pickup'; status: string };
export function OrderingExperience({ initialNow }: { initialNow: string }) {
  return <CartProvider storageKey="sushinaa-curbside-basket-v1"><Experience initialNow={initialNow} /></CartProvider>;
}
function Experience({ initialNow }: { initialNow: string }) {
  const { lang, t } = useLocale();
  const viewMenuHref = '/';
  const [paymentProvider, setPaymentProvider] = useState<'mock' | 'counter' | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'mock' | 'pay_at_pickup'>('mock');
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
  const branch = branches.find(b => b.slug === branchId);
  const status = branch ? branchStatus(branch.hours, qatarClock(now)) : null;
  const money = (minor: number) => `${new Intl.NumberFormat(lang === 'ar' ? 'ar-QA' : 'en-QA', { maximumFractionDigits: 2 }).format(minor / 100)} ${text('QAR', 'ر.ق')}`;
  const ticketMoney = (qar: number) => formatQar(qar, lang, menu.settings);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 15000);
    void fetch('/api/orders').then(async r => { if (!r.ok) return; const data = await r.json(); setPaymentProvider(data.paymentProvider); if (data.paymentProvider === 'counter') setPaymentMethod('pay_at_pickup'); }).catch(() => {});
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (previousStep.current !== step) heading.current?.focus();
    previousStep.current = step;
  }, [step]);
  function go(next: Step) { setError(''); setStep(next); window.scrollTo({ top: 0, behavior: 'instant' }); }
  function changeBranch() { setReturnStep(step === 'branches' ? 'menu' : step === 'payment' || step === 'receipt' ? 'review' : step); go('branches'); }
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
      const session = await fetch('/api/orders');
      if (!session.ok) { setError(errorMessage('ORDERING_UNAVAILABLE')); return; }
      const body = JSON.stringify({ branchId, customer, paymentMethod, lines: cart.lines.map(line => ({ dishId: line.dish.id, selection: line.sel, quantity: line.qty, note: line.note, expectedUnitMinor: Math.round(line.unitQar * 100) })) });
      if (attempt.current?.body !== body) {
        // crypto.randomUUID is unavailable on an HTTP LAN preview; getRandomValues works there.
        const bytes = crypto.getRandomValues(new Uint8Array(20));
        attempt.current = { body, key: Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('') };
      }
      const res = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': attempt.current.key }, body });
      const data = await res.json();
      if (!res.ok) { setError(errorMessage(data.code)); return; }
      setReceipt(data); go(data.paymentMethod === 'pay_at_pickup' || data.paymentStatus === 'paid' ? 'receipt' : 'payment');
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
  const title = step === 'branches' ? text('Choose a branch', 'اختر الفرع')
    : step === 'basket' ? text('Your basket', 'سلتك')
    : step === 'details' ? text('Collection details', 'بيانات الاستلام')
    : step === 'review' ? text('Review your order', 'راجع طلبك')
    : step === 'receipt' ? text('Your order', 'طلبك') : text('Payment', 'الدفع');
  const count = cart.itemCount;
  const closedNotice = status && !status.open ? <div className="checkout-notice" role="status"><strong>{text('This branch is currently closed', 'هذا الفرع مغلق حالياً')}</strong><p>{text('Browse and save your favourites, or choose an open branch to continue.', 'تصفح واحفظ أصنافك المفضلة، أو اختر فرعاً مفتوحاً للمتابعة.')}</p><button type="button" className="text-action" onClick={changeBranch}>{text('Choose another branch', 'اختر فرعاً آخر')}</button></div> : null;
  function ticket(editable: boolean, canEditBasket = false) { return <section className="ticket checkout-ticket" aria-label={t.yourTicket}>
    <div className="ticket-scallop" aria-hidden="true" />
    <header className="ticket-head"><div><p className="ticket-kicker">{t.brand}</p><h2 className="ticket-title">{t.yourTicket}</h2></div>{canEditBasket ? <button type="button" className="ticket-edit" onClick={() => go('basket')}>{text('Edit items', 'تعديل الأصناف')}</button> : <span className="ticket-count">{count} {text(count === 1 ? 'item' : 'items', 'صنف')}</span>}</header>
    <p className="ticket-rule" aria-hidden="true" />
    <ul className="ticket-lines">{cart.lines.map(line => <li key={line.key} className="ticket-line">
      <div className="line-main"><p className="line-name">{line.displayName}</p>{line.meta && <p className="line-meta">{line.meta}</p>}{line.qty > 1 && <p className="line-meta line-unit">{line.qty} × {ticketMoney(line.unitQar)}</p>}{line.note && <p className="line-note">{t.commentWord}: {line.note}</p>}{editable && <button type="button" className="ticket-edit" onClick={() => setEditing(line)}>{text('Edit choices & notes', 'تعديل الخيارات والملاحظات')}</button>}</div>
      {editable ? <div className="line-qty"><button type="button" className="qty-btn" onClick={() => cart.dec(line.key)} aria-label={t.fewerOf(line.displayName)}>−</button><span className="qty-num">{line.qty}</span><button type="button" className="qty-btn" onClick={() => cart.inc(line.key)} disabled={line.qty >= 20} aria-label={t.moreOf(line.displayName)}>+</button></div> : <span className="ticket-static-qty" aria-label={text(`Quantity ${line.qty}`, `الكمية ${line.qty}`)}>×{line.qty}</span>}
      <p className="line-total">{ticketMoney(line.lineTotal)}</p>
    </li>)}</ul>
    <div className="ticket-sum"><span>{t.total}</span><strong>{ticketMoney(cart.totalQar)}</strong></div>
  </section>; }
  const receiptBody = (editable: boolean) => <>
    <section className="review-details"><div className="review-section-title"><h2>{text('At your car', 'عند سيارتك')}</h2>{editable && <button type="button" className="text-action" onClick={() => go('details')}>{text('Edit', 'تعديل')}</button>}</div><strong>{customer.name}</strong><p dir="ltr" className="review-phone">+{customer.phone}</p><QatarPlate plate={customer.plate} /><p>{[customer.colour, customer.car].filter(Boolean).join(' · ')}</p>{customer.instructions && <p className="checkout-note">{customer.instructions}</p>}</section>
    {ticket(false, editable)}
  </>;
  if (step === 'payment' && receipt && receipt.paymentMethod === 'mock') return <MockSadadGateway amount={money(receipt.totalMinor)} lang={lang} onBack={() => go('review')} onComplete={() => go('receipt')} onPay={async () => {
    const response = await fetch(`/api/orders/${receipt.id}/mock-pay`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const result = await response.json();
    if (!response.ok || result.paymentStatus !== 'paid') throw new Error(errorMessage(result.code || 'NETWORK'));
    setReceipt(result);
  }} />;
  return <div className="ordering-page" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
    <div className="ordering-content" inert={Boolean(editing)}>
      <header className="ordering-header"><Link href={viewMenuHref} aria-label={text('View-only menu', 'قائمة التصفح')}><Image src={menu.settings.logo} width={59} height={55} alt={t.brand} unoptimized /></Link><LangButton /></header>
      {step === 'branches' ? <>
        <main id="main" className="branch-page">
          <div className="branch-intro"><h1 ref={heading} tabIndex={-1}>{title}</h1><p>{text('We’ll bring your order to your car.', 'نُحضر طلبك إلى سيارتك.')}</p></div>
          <BranchMap lang={lang} now={now} onChoose={choose} />
          <Link className="view-menu-link" href={viewMenuHref}>{text('Just exploring? View the menu', 'تستكشف فقط؟ تصفح القائمة')}</Link>
        </main>
      </> : <>
        {step !== 'receipt' && <div className="checkout-navigation"><button type="button" className="text-action" disabled={busy} onClick={() => go(step === 'basket' ? 'menu' : step === 'details' ? 'basket' : step === 'review' ? 'details' : 'review')}><span className="back-arrow" aria-hidden="true">←</span> {text('Back', 'رجوع')}</button>{(['basket', 'details', 'review'] as Step[]).includes(step) && <span aria-label={text(`Step ${['basket', 'details', 'review'].indexOf(step) + 1} of 3`, `الخطوة ${['basket', 'details', 'review'].indexOf(step) + 1} من ٣`)}>{['basket', 'details', 'review'].indexOf(step) + 1} / 3</span>}</div>}
        <main id="main" className="checkout-main">
          <h1 ref={heading} tabIndex={-1}>{title}</h1>
          {step !== 'receipt' && branchControl}
          {step !== 'payment' && step !== 'receipt' && closedNotice}
          {step !== 'receipt' && cart.unavailableCount > 0 && <div className="checkout-notice" role="alert"><strong>{text('Your basket needs an update', 'تحتاج سلتك إلى تحديث')}</strong><p>{text(`${cart.unavailableCount} serving(s) or their choices are no longer available. Remove them before continuing.`, `${cart.unavailableCount} حصة أو خياراتها لم تعد متوفرة. احذفها قبل المتابعة.`)}</p><button type="button" className="text-action" onClick={cart.discardUnavailable}>{text('Remove unavailable selections', 'حذف الخيارات غير المتوفرة')}</button></div>}
          {step === 'basket' && <>
            {count ? <>{ticket(true)}<button type="button" className="text-action add-more" onClick={() => go('menu')}>+ {text('Add item', 'أضف صنفاً')}</button><div className="checkout-step-action"><button type="button" className="checkout-primary" disabled={cart.unavailableCount > 0} onClick={() => go('details')}>{text('Continue to collection details', 'المتابعة لبيانات الاستلام')}<Forward /></button></div></> : <div className="empty-basket"><CarIcon /><h2>{text('Your basket is empty', 'سلتك فارغة')}</h2><button type="button" className="checkout-primary" onClick={() => go('menu')}>{text('Browse menu', 'تصفح القائمة')}<Forward /></button></div>}
          </>}
          {step === 'details' && <>
            <form onSubmit={validateDetails} noValidate>
            <div className="checkout-fields">{(['name', 'phone', 'plate'] as const).map(key => {
              const label = { name: text('Your name', 'اسمك'), phone: text('Mobile number', 'رقم الجوال'), plate: text('Qatar plate number', 'رقم اللوحة القطرية'), colour: text('Car colour', 'لون السيارة'), car: text('Make / model', 'نوع / طراز السيارة'), instructions: text('Collection instructions', 'تعليمات الاستلام') }[key];
              const invalid = errors.includes(key);
              if (key === 'plate') return <div key={key} className="checkout-field field-plate"><label htmlFor="collection-plate">{label}</label>
                <div className="plate-entry" dir="ltr"><span className="plate-country"><span className="plate-flag" aria-hidden="true">🇶🇦</span><span>QATAR<br /><span lang="ar">قطر</span></span></span><input id="collection-plate" type="text" inputMode="numeric" autoComplete="off" required minLength={3} maxLength={6} pattern="[0-9]{3,6}" placeholder="000000" value={customer.plate.slice(1)} aria-label={text('Plate number, 3 to 6 digits', 'رقم اللوحة، من ٣ إلى ٦ أرقام')} aria-invalid={invalid} aria-describedby={invalid ? 'hint-plate' : undefined} onChange={e => { const number = digits(e.target.value).replace(/\D/g, '').slice(0, 6); setCustomer({ ...customer, plate: `${customer.plate[0] || 'Q'}${number}` }); setErrors(errors.filter(x => x !== 'plate')); }} /><strong className="plate-current-series" aria-hidden="true">{customer.plate[0] || 'Q'}</strong></div>
                <div className="plate-series" role="group" aria-label={text('Plate letter', 'حرف اللوحة')}>{(['Q', 'T', 'R'] as const).map(series => <button key={series} type="button" className={customer.plate[0] === series ? 'selected' : ''} aria-pressed={customer.plate[0] === series} onClick={() => { setCustomer({ ...customer, plate: `${series}${customer.plate.slice(1)}` }); setErrors(errors.filter(x => x !== 'plate')); }}>{series}</button>)}</div>
                {invalid && <small id="hint-plate" className="field-error">{text('Enter 3–6 digits and choose Q, T or R.', 'أدخل من ٣ إلى ٦ أرقام واختر Q أو T أو R.')}</small>}
              </div>;
              return <label key={key} className={`checkout-field field-${key}`} htmlFor={`collection-${key}`}><span>{label}</span>
                {key === 'phone' ? <div className="qatar-phone-field" dir="ltr"><span className="qatar-phone-prefix"><span role="img" aria-label={text('Qatar flag', 'علم قطر')}>🇶🇦</span> +974</span><input id="collection-phone" type="tel" inputMode="numeric" autoComplete="tel-national" pattern="[0-9]*" required maxLength={8} value={customer.phone.replace(/^974/, '')} aria-invalid={invalid} aria-describedby={invalid ? 'hint-phone' : undefined} onChange={e => { const national = digits(e.target.value).replace(/\D/g, '').slice(0, 8); setCustomer({ ...customer, phone: national ? `974${national}` : '' }); setErrors(errors.filter(x => x !== 'phone')); }} /></div>
                  : <input id={`collection-${key}`} type="text" autoComplete={key === 'name' ? 'name' : 'off'} required maxLength={100} value={customer[key]} aria-invalid={invalid} aria-describedby={invalid ? `hint-${key}` : undefined} onChange={e => { setCustomer({ ...customer, [key]: e.target.value }); setErrors(errors.filter(x => x !== key)); }} />}
                {invalid && <small id={`hint-${key}`} className="field-error">{key === 'phone' ? text('Enter a valid Qatar mobile number.', 'أدخل رقم جوال قطرياً صالحاً.') : text('Please enter your name.', 'يرجى إدخال اسمك.')}</small>}
              </label>;
            })}</div>
            <details className="optional-vehicle"><summary>{text('Add vehicle details', 'أضف تفاصيل السيارة')}</summary><div className="checkout-fields">{(['colour', 'car', 'instructions'] as const).map(key => <label key={key} className={`checkout-field field-${key}`} htmlFor={`collection-${key}`}><span>{{ colour: text('Car colour', 'لون السيارة'), car: text('Make / model', 'نوع / طراز السيارة'), instructions: text('Collection instructions', 'تعليمات الاستلام') }[key]}</span>{key === 'instructions' ? <textarea id={`collection-${key}`} value={customer[key]} maxLength={400} rows={3} onChange={e => setCustomer({ ...customer, [key]: e.target.value })} /> : <input id={`collection-${key}`} value={customer[key]} maxLength={key === 'colour' ? 50 : 80} onChange={e => setCustomer({ ...customer, [key]: e.target.value })} />}</label>)}</div></details>
            <CollectionNotice title={t.privacyTitle} />
            <div className="checkout-step-action"><button type="submit" className="checkout-primary" disabled={!status?.open || !count || cart.unavailableCount > 0}>{text('Review order', 'مراجعة الطلب')}<Forward /></button></div>
          </form>
          </>}
          {step === 'review' && <>
            {receiptBody(true)}
            {paymentProvider === 'mock' && <div className="checkout-payment-choice" role="radiogroup" aria-label={text('Payment method', 'طريقة الدفع')}>{(['mock', 'pay_at_pickup'] as const).map(method => <button key={method} type="button" role="radio" aria-checked={paymentMethod === method} onClick={() => setPaymentMethod(method)}>{method === 'mock' ? text('Mock payment', 'دفع تجريبي') : text('Pay at pickup', 'الدفع عند الاستلام')}</button>)}</div>}
            <div className="checkout-step-action"><button type="button" className="checkout-primary" disabled={busy || !status?.open || !count || cart.unavailableCount > 0} onClick={checkout}>{busy ? text('Checking…', 'جارٍ التحقق…') : paymentMethod === 'pay_at_pickup' ? text('Place order · pay at pickup', 'تأكيد الطلب · الدفع عند الاستلام') : text('Continue to payment', 'المتابعة إلى الدفع')}<Forward /></button></div>
          </>}
          {step === 'receipt' && receipt && <><div className="demo-receipt-status" role="status"><span aria-hidden="true">✓</span><strong>{receipt.paymentMethod === 'mock' ? text('Payment confirmed', 'تم تأكيد الدفع') : text('Order received · pay at pickup', 'تم استلام الطلب · الدفع عند الاستلام')}</strong><small dir="ltr" className="order-confirmation-reference">{receipt.id}</small>{receipt.paymentMethod === 'mock' && <small>{text('Demo only · no charge', 'تجريبي')}</small>}</div>{branch && <DirectionsLink branchName={branchName} href={branch.mapsUrl} text={text} />}{receiptBody(false)}<button type="button" className="checkout-primary" onClick={() => { cart.clear(); setCustomer(emptyCustomer); setReceipt(null); attempt.current = null; go('menu'); }}>{text('Back to menu', 'العودة للقائمة')}<Forward /></button></>}
          {error && <div className="checkout-error" role="alert"><p>{error}</p><button className="text-action" type="button" onClick={() => { go('basket'); router.refresh(); }}>{text('Refresh menu', 'تحديث القائمة')}</button></div>}
        </main>
      </>}
      <footer className="ordering-footer"><span>SUSHINAA</span><span>{text('Private ordering preview', 'معاينة خاصة للطلب')}</span></footer>
    </div>
    {editing && <DishDetailSheet dish={editing.dish} ordering initialEntries={Array.from({ length: editing.qty }, () => ({ sel: editing.sel, note: editing.note }))} onSave={entries => cart.replace(editing.key, entries)} onClose={() => setEditing(null)} />}
  </div>;
}
function QatarPlate({ plate }: { plate: string }) { return <div className="plate-card" dir="ltr" aria-label={`Qatar plate ${plate[0]} ${plate.slice(1)}`}><span className="plate-country"><span className="plate-flag" aria-hidden="true">🇶🇦</span><span>QATAR<br /><span lang="ar">قطر</span></span></span><strong className="plate-digits">{plate.slice(1)}</strong><strong className="plate-letter">{plate[0]}</strong></div>; }
function DirectionsLink({ branchName, href, text }: { branchName: string; href: string; text: (en: string, ar: string) => string }) { return <a className="directions-link" href={href} target="_blank" rel="noopener noreferrer" aria-label={text(`Open Google Maps directions to ${branchName}`, `افتح خرائط Google للوصول إلى ${branchName}`)}><span className="directions-pin" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z" stroke="currentColor" strokeWidth="1.6"/><circle cx="12" cy="10" r="2.3" stroke="currentColor" strokeWidth="1.6"/></svg></span><span className="directions-copy"><strong>{text('Get directions', 'اتجاهات الوصول')}</strong><small>{branchName} · Google Maps</small></span><span className="directions-arrow" aria-hidden="true">↗</span></a>; }
function Forward() { return <span className="forward-arrow" aria-hidden="true">→</span>; }
function CarIcon() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m5 9 2-5h10l2 5M4 9h16a1 1 0 0 1 1 1v7H3v-7a1 1 0 0 1 1-1ZM5 17v3m14-3v3M6 13h2m8 0h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
