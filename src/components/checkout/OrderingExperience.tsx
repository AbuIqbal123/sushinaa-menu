'use client';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { MenuFeed } from '@/components/menu/MenuFeed';
import { DishDetailSheet } from '@/components/menu/DishDetailSheet';
import { CartProvider, useCart, type CartLine } from '@/ordering/cart';
import { useMenu } from '@/cms/context';
import { LangButton, useLocale, useSetSheetOpen } from '@/i18n/locale';
import { BRANCHES as branches, type BranchId } from '@/branches/branches';
import { branchStatus, qatarClock } from '@/branches/hours';
import { customerSchema, digits, displayPhone, type Customer } from '@/ordering/checkout/validation';
import { formatQar } from '@/lib/money';
import type { PaymentStatus } from '@/ordering/checkout/payment';
import { MockSadadGateway } from './MockSadadGateway';
import { OrderProgress } from './OrderProgress';

const emptyCustomer: Customer = { name: '', phone: '', plate: 'Q', colour: '', car: '', instructions: '' };
type Step = 'menu' | 'details' | 'review' | 'payment' | 'receipt';
type Receipt = { id: string; orderNumber?: number | null; paymentStatus: PaymentStatus; totalMinor: number; paymentMethod: 'mock' | 'pay_at_pickup'; status: string };
export function OrderingExperience({ initialNow, branchId }: { initialNow: string; branchId: BranchId }) {
  return <CartProvider storageKey="sushinaa-curbside-basket-v1"><Experience initialNow={initialNow} branchId={branchId} /></CartProvider>;
}
function Experience({ initialNow, branchId: initialBranch }: { initialNow: string; branchId: BranchId }) {
  const { lang, t } = useLocale();
  const [paymentProvider, setPaymentProvider] = useState<'mock' | 'counter' | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'mock' | 'pay_at_pickup'>('mock');
  const text = (en: string, ar: string) => lang === 'ar' ? ar : en;
  const menu = useMenu();
  const router = useRouter();
  const cart = useCart();
  const [step, setStep] = useState<Step>('menu');
  const [motion, setMotion] = useState<'forward' | 'back'>('forward');
  const [branchId] = useState<BranchId>(initialBranch);
  const [now, setNow] = useState(() => new Date(initialNow));
  const [customer, setCustomer] = useState<Customer>(emptyCustomer);
  const [errors, setErrors] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const attempt = useRef<{ body: string; key: string } | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const orderKey = 'sushinaa-order-id';
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
  useEffect(() => {
    const stored = sessionStorage.getItem(orderKey);
    if (!stored) return;
    let cancel = false;
    void fetch(`/api/orders/${stored}`, { cache: 'no-store' }).then(async (response) => {
      if (!response.ok || cancel) return;
      setReceipt(await response.json() as Receipt);
      setStep('receipt');
    }).catch(() => {});
    return () => { cancel = true; };
  }, []);
  useEffect(() => {
    if (step !== 'receipt' || !receipt?.id) return;
    sessionStorage.setItem(orderKey, receipt.id);
    if (receipt.status === 'completed' || receipt.status === 'refunded') return;
    let stopped = false;
    let running = false;
    const controller = new AbortController();
    const pull = async () => {
      if (document.hidden || running || stopped) return;
      running = true;
      try {
        const response = await fetch(`/api/orders/${receipt.id}`, { cache: 'no-store', signal: controller.signal });
        if (response.ok && !stopped) setReceipt(await response.json() as Receipt);
      } catch { /* Keep the last confirmed state and retry when online. */ }
      finally { running = false; }
    };
    void pull();
    document.addEventListener('visibilitychange', pull);
    window.addEventListener('online', pull);
    const timer = window.setInterval(pull, 5000);
    return () => {
      stopped = true; controller.abort(); window.clearInterval(timer);
      document.removeEventListener('visibilitychange', pull); window.removeEventListener('online', pull);
    };
  }, [step, receipt?.id, receipt?.status]);
  function go(next: Step) {
    const order: Step[] = ['menu', 'details', 'review', 'payment', 'receipt'];
    setMotion(order.indexOf(next) < order.indexOf(step) ? 'back' : 'forward');
    setError(''); setStep(next); window.scrollTo({ top: 0, behavior: 'instant' });
  }
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
    CLOSED: text('This branch has closed. Your basket is saved.', 'هذا الفرع مغلق الآن. سلتك محفوظة.'),
    PRICE_CHANGED: text('A price has changed. Refresh the menu and review your basket before continuing.', 'تغيّر أحد الأسعار. حدّث القائمة وراجع سلتك قبل المتابعة.'),
    UNAVAILABLE: text('An item is no longer available. Refresh the menu to update your basket.', 'أحد الأصناف لم يعد متوفراً. حدّث القائمة لتحديث سلتك.'),
    OPTIONS: text('Some choices have changed. Refresh the menu and edit the affected item.', 'تغيّرت بعض الخيارات. حدّث القائمة وعدّل الصنف.'),
    LIMIT: text('The order limit was reached. Reduce the quantity or try again later.', 'تم الوصول إلى الحد المسموح. قلّل الكمية أو حاول لاحقاً.'),
    CONFLICT: text('This checkout attempt has changed. Return to review and try again.', 'تغيّرت محاولة الدفع هذه. عُد للمراجعة وحاول مجدداً.'),
    ORDERING_UNAVAILABLE: text('Ordering is unavailable right now. Your basket is still here.', 'الطلب غير متاح الآن. سلتك ما زالت محفوظة.'),
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
      setReceipt(data); sessionStorage.setItem(orderKey, data.id); go(data.paymentMethod === 'pay_at_pickup' || data.paymentStatus === 'paid' ? 'receipt' : 'payment');
    } catch { setError(errorMessage('NETWORK')); }
    finally { setBusy(false); busyRef.current = false; }
  }
  const branchName = branch ? text(branch.name, branch.nameAr) : '';
  if (step === 'menu' && branch) return <div className="app-lock"><MenuFeed branch={branchName} onPickup={() => go('details')} /></div>;
  const title = step === 'details' ? text('Collection details', 'بيانات الاستلام')
    : step === 'review' ? text('Review your order', 'راجع طلبك')
    : step === 'receipt' ? text('Your order', 'طلبك') : text('Payment', 'الدفع');
  const count = cart.itemCount;
  const demoOpen = paymentProvider === 'mock';
  const canPlace = Boolean(status?.open || demoOpen);
  const closedNotice = status && !status.open ? <div className="checkout-notice" role="status"><strong>{text('This branch is currently closed', 'هذا الفرع مغلق حالياً')}</strong><p>{demoOpen ? text('You can still place this order.', 'يمكنك إتمام هذا الطلب.') : text('Come back when this branch is open. Your basket is saved.', 'عُد عندما يفتح هذا الفرع. سلتك محفوظة.')}</p></div> : null;
  function ticket(editable: boolean, canEditBasket = false, serverMinor?: number) { return <section className="ticket checkout-ticket" aria-label={t.yourTicket}>
    <div className="ticket-scallop" aria-hidden="true" />
    <header className="ticket-head"><div><p className="ticket-kicker">{t.brand}</p><h2 className="ticket-title">{t.yourTicket}</h2></div>{canEditBasket ? <button type="button" className="ticket-edit" onClick={() => go('menu')}>{text('Edit items', 'تعديل الأصناف')}</button> : <span className="ticket-count">{count} {text(count === 1 ? 'item' : 'items', 'صنف')}</span>}</header>
    <p className="ticket-rule" aria-hidden="true" />
    <ul className="ticket-lines">{cart.lines.map(line => <li key={line.key} className="ticket-line">
      <div className="line-main"><p className="line-name">{line.displayName}</p>{line.meta && <p className="line-meta">{line.meta}</p>}{line.qty > 1 && <p className="line-meta line-unit">{line.qty} × {ticketMoney(line.unitQar)}</p>}{line.note && <p className="line-note">{t.commentWord}: {line.note}</p>}{editable && <button type="button" className="ticket-edit" onClick={() => setEditing(line)}>{text('Edit choices & notes', 'تعديل الخيارات والملاحظات')}</button>}</div>
      {editable ? <div className="line-qty"><button type="button" className="qty-btn" onClick={() => cart.dec(line.key)} aria-label={t.fewerOf(line.displayName)}>−</button><span className="qty-num">{line.qty}</span><button type="button" className="qty-btn" onClick={() => cart.inc(line.key)} disabled={line.qty >= 20} aria-label={t.moreOf(line.displayName)}>+</button></div> : <span className="ticket-static-qty" aria-label={text(`Quantity ${line.qty}`, `الكمية ${line.qty}`)}>×{line.qty}</span>}
      <p className="line-total">{ticketMoney(line.lineTotal)}</p>
    </li>)}</ul>
    <div className="ticket-sum"><span>{t.total}</span><strong>{serverMinor != null ? money(serverMinor) : ticketMoney(cart.totalQar)}</strong></div>
  </section>; }
  const receiptBody = (editable: boolean, serverMinor?: number) => <>
    <section className="review-details">{editable && <div className="review-section-title"><button type="button" className="text-action" onClick={() => go('details')}>{text('Edit', 'تعديل')}</button></div>}<strong>{customer.name}</strong><p dir="ltr" className="review-phone">{displayPhone(customer.phone)}</p><QatarPlate plate={customer.plate} /><p>{[customer.colour, customer.car].filter(Boolean).join(' · ')}</p>{customer.instructions && <p className="checkout-note">{customer.instructions}</p>}</section>
    {ticket(false, editable, serverMinor)}
  </>;
  if (step === 'payment' && receipt && receipt.paymentMethod === 'mock') return <MockSadadGateway amount={money(receipt.totalMinor)} lang={lang} onBack={() => go('review')} onComplete={() => go('receipt')} onPay={async () => {
    const response = await fetch(`/api/orders/${receipt.id}/mock-pay`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const result = await response.json();
    if (!response.ok || result.paymentStatus !== 'paid') throw new Error(errorMessage(result.code || 'NETWORK'));
    setReceipt(result);
  }} />;
  return <div className="ordering-page" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
    <div className="ordering-content" inert={Boolean(editing)}>
      <header className="ordering-header"><button type="button" className="ordering-logo" onClick={() => go('menu')} aria-label={text('Back to the menu', 'العودة إلى القائمة')}><Image src={menu.settings.logo} width={59} height={55} alt={t.brand} unoptimized /></button><LangButton /></header>
      <>
        {step !== 'receipt' && <div className="checkout-navigation"><button type="button" className="text-action" disabled={busy} onClick={() => go(step === 'details' ? 'menu' : step === 'review' ? 'details' : 'review')}><span className="back-arrow" aria-hidden="true">←</span> {text('Back', 'رجوع')}</button>{(['details', 'review'] as Step[]).includes(step) && <span aria-label={text(`Step ${['details', 'review'].indexOf(step) + 1} of 2`, `الخطوة ${['details', 'review'].indexOf(step) + 1} من ٢`)}>{['details', 'review'].indexOf(step) + 1} / 2</span>}</div>}
        <main id="main" className="checkout-main checkout-step" data-motion={motion} key={step}>
          <h1 ref={heading} tabIndex={-1}>{title}</h1>
          {step === 'details' && <p className="checkout-branch">{text('Pickup', 'استلام')} · <strong>{branchName}</strong></p>}
          {step !== 'payment' && step !== 'receipt' && closedNotice}
          {step !== 'receipt' && cart.unavailableCount > 0 && <div className="checkout-notice" role="alert"><strong>{text('Your basket needs an update', 'تحتاج سلتك إلى تحديث')}</strong><p>{text(`${cart.unavailableCount} serving(s) or their choices are no longer available. Remove them before continuing.`, `${cart.unavailableCount} حصة أو خياراتها لم تعد متوفرة. احذفها قبل المتابعة.`)}</p><button type="button" className="text-action" onClick={cart.discardUnavailable}>{text('Remove unavailable selections', 'حذف الخيارات غير المتوفرة')}</button></div>}
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
            <div className="checkout-step-action"><button type="submit" className="checkout-primary" disabled={!canPlace || !count || cart.unavailableCount > 0}>{text('Review order', 'مراجعة الطلب')}<Forward /></button></div>
          </form>
          </>}
          {step === 'review' && <>
            {receiptBody(true)}
            <div className="checkout-step-action"><button type="button" className="checkout-primary" disabled={busy || !canPlace || !count || cart.unavailableCount > 0} onClick={checkout}>{busy ? text('Checking…', 'جارٍ التحقق…') : paymentMethod === 'pay_at_pickup' ? text('Place order · pay at pickup', 'تأكيد الطلب · الدفع عند الاستلام') : text('Continue to payment', 'المتابعة إلى الدفع')}<Forward /></button></div>
          </>}
          {step === 'receipt' && receipt && <div data-order-id={receipt.id}>
            <p className="order-confirmed" role="status">{receipt.paymentMethod === 'mock' ? text('Payment confirmed', 'تم تأكيد الدفع') : text('Order received', 'تم استلام الطلب')}</p>
            {receipt.orderNumber != null && <p className="order-number" dir="ltr"><span>{text('Order number', 'رقم الطلب')}</span>{receipt.orderNumber}</p>}
            <OrderProgress status={receipt.status} lang={lang} />
            <p className="checkout-branch">{text('Pickup', 'استلام')} · <strong>{branchName}</strong></p>
            {branch && <DirectionsLink branchName={branchName} href={branch.mapsUrl} text={text} />}
            <p className="order-who"><strong>{customer.name}</strong><span dir="ltr">{displayPhone(customer.phone)}</span></p>
            <QatarPlate plate={customer.plate} />
            <ul className="order-summary">{cart.lines.map(line => <li key={line.key}><span><b>{line.displayName}</b>{line.meta && <small>{line.meta}</small>}{line.note && <small>{line.note}</small>}</span><span>×{line.qty}</span><span dir="ltr">{ticketMoney(line.lineTotal)}</span></li>)}</ul>
            <p className="order-total"><span>{t.total}</span><strong dir="ltr">{money(receipt.totalMinor)}</strong></p>
            <button type="button" className="checkout-primary" onClick={() => { cart.clear(); setCustomer(emptyCustomer); setReceipt(null); sessionStorage.removeItem(orderKey); attempt.current = null; go('menu'); }}>{text('Back to menu', 'العودة للقائمة')}<Forward /></button>
          </div>}
          {error && <div className="checkout-error" role="alert"><p>{error}</p><button className="text-action" type="button" onClick={() => { go('menu'); router.refresh(); }}>{text('Refresh menu', 'تحديث القائمة')}</button></div>}
        </main>
      </>
      <footer className="ordering-footer"><span>Sushinaa</span></footer>
    </div>
    {editing && <DishDetailSheet dish={editing.dish} ordering initialEntries={Array.from({ length: editing.qty }, () => ({ sel: editing.sel, note: editing.note }))} onSave={entries => cart.replace(editing.key, entries)} onClose={() => setEditing(null)} />}
  </div>;
}
function QatarPlate({ plate }: { plate: string }) { return <div className="plate-card" dir="ltr" aria-label={`Qatar plate ${plate[0]} ${plate.slice(1)}`}><span className="plate-country"><span className="plate-flag" aria-hidden="true">🇶🇦</span><span>QATAR<br /><span lang="ar">قطر</span></span></span><strong className="plate-digits">{plate.slice(1)}</strong><strong className="plate-letter">{plate[0]}</strong></div>; }
function DirectionsLink({ branchName, href, text }: { branchName: string; href: string; text: (en: string, ar: string) => string }) { return <a className="directions-link" href={href} target="_blank" rel="noopener noreferrer" aria-label={text(`Open Google Maps directions to ${branchName}`, `افتح خرائط Google للوصول إلى ${branchName}`)}><span className="directions-pin" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z" stroke="currentColor" strokeWidth="1.6"/><circle cx="12" cy="10" r="2.3" stroke="currentColor" strokeWidth="1.6"/></svg></span><span className="directions-copy"><strong>{text('Get directions', 'اتجاهات الوصول')}</strong><small>{branchName} · Google Maps</small></span><span className="directions-arrow" aria-hidden="true">↗</span></a>; }
function Forward() { return <span className="forward-arrow" aria-hidden="true">→</span>; }
