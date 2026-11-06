'use client';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { MenuFeed } from '@/components/menu/MenuFeed';
import { DishDetailSheet } from '@/components/menu/DishDetailSheet';
import { CartProvider, useCart, type CartLine } from '@/ordering/cart';
import { useMenu } from '@/cms/context';
import { LangButton, useLocale, useSetSheetOpen } from '@/i18n/locale';
import { configuredBranches, type BranchId } from '@/branches/branches';
import { branchStatus, qatarClock } from '@/branches/hours';
import { displayPhone, type Customer } from '@/ordering/checkout/validation';
import { CollectionDetailsForm } from './CollectionDetailsForm';
import { formatQar } from '@/lib/money';
import { formatOrderNumber } from '@/ordering/order-number';
import type { CustomerReceiptDetails } from '@/ordering/contracts';
import { selectionLabel } from '@/ordering/price';
import { pickName } from '@/i18n/localize';
import type { PaymentStatus } from '@/ordering/checkout/payment';
import { MockSadadGateway } from './MockSadadGateway';
import { submitHostedCheckout } from './submit-hosted-checkout';
import { CarBrandLogo } from './CarBrandPicker';
import { carBrandName, findCarBrand } from '@/ordering/car-brands';
import { OrderProgress, orderPhase, orderTrackingLabel } from './OrderProgress';
import { CouponField, knownCouponMessage, type AppliedCoupon } from './CouponField';
import {
  clearReceiptDismissed,
  isReceiptDismissed,
  isTerminalCustomerStatus,
  markReceiptDismissed,
  shouldResumeCustomerReceipt,
} from '@/ordering/customer-tracking';
import { paymentFailCopy, paymentFailNoticeKind, type PaymentFailNoticeKind } from '@/ordering/payment-fail-notice';
import { cartMatchesPlaced } from '@/ordering/checkout/cart-matches-placed';

const emptyCustomer: Customer = { name: '', phone: '', plate: 'Q', brand: '', colour: '', car: '', instructions: '' };
type Step = 'menu' | 'details' | 'review' | 'payment' | 'receipt';
type PaymentMethodUi = 'mock' | 'pay_at_pickup' | 'sadad';
type Receipt = { id: string; orderNumber?: number | null; paymentStatus: PaymentStatus; totalMinor: number; paymentMethod: PaymentMethodUi; status: string; arrivedAt?: string | null; updatedAt?: string | null; details?: CustomerReceiptDetails; failedPaymentCount?: number };
export function OrderingExperience({
  initialNow,
  branchId,
  returnPaidId,
  payFailed: initialPayFailed = false,
}: {
  initialNow: string;
  branchId: BranchId;
  /** Set on `/{branch}/order?paid=` so we never paint the menu before the receipt. */
  returnPaidId?: string;
  payFailed?: boolean;
}) {
  return (
    <CartProvider storageKey="sushinaa-curbside-basket-v1">
      <Experience initialNow={initialNow} branchId={branchId} returnPaidId={returnPaidId} payFailed={initialPayFailed} />
    </CartProvider>
  );
}
function Experience({
  initialNow,
  branchId: initialBranch,
  returnPaidId,
  payFailed: initialPayFailed,
}: {
  initialNow: string;
  branchId: BranchId;
  returnPaidId?: string;
  payFailed: boolean;
}) {
  const { lang, t } = useLocale();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodUi>('mock');
  const [redirecting, setRedirecting] = useState(false);
  const text = (en: string, ar: string) => lang === 'ar' ? ar : en;
  const menu = useMenu();
  const branches = configuredBranches(menu.branches);
  const router = useRouter();
  const cart = useCart();
  const returnMode = Boolean(returnPaidId || initialPayFailed);
  const [recovering, setRecovering] = useState(returnMode);
  const [step, setStep] = useState<Step>(returnMode ? 'receipt' : 'menu');
  const [motion, setMotion] = useState<'forward' | 'back'>('forward');
  const [branchId] = useState<BranchId>(initialBranch);
  const [now, setNow] = useState(() => new Date(initialNow));
  const [customer, setCustomer] = useState<Customer>(emptyCustomer);
  /** Draft while typing on details; avoids re-rendering the parked menu each keystroke. */
  const customerDraft = useRef<Customer>(emptyCustomer);
  const [error, setError] = useState('');
  const [payFailNotice, setPayFailNotice] = useState<PaymentFailNoticeKind | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const attempt = useRef<{ body: string; key: string } | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [couponPending, setCouponPending] = useState(false);
  /** Scoped per branch so a Downtown receipt does not open on Al Thumama. */
  const orderKey = `sushinaa-order-id:${branchId}`;
  const legacyOrderKey = 'sushinaa-order-id';
  function forgetStoredOrder() {
    try {
      localStorage.removeItem(orderKey);
      sessionStorage.removeItem(orderKey);
      localStorage.removeItem(legacyOrderKey);
      sessionStorage.removeItem(legacyOrderKey);
    } catch { /* Storage unavailable. */ }
  }
  function readStoredOrderId() {
    try {
      return (
        localStorage.getItem(orderKey)
        || sessionStorage.getItem(orderKey)
        || localStorage.getItem(legacyOrderKey)
        || sessionStorage.getItem(legacyOrderKey)
      );
    } catch {
      return null;
    }
  }
  function rememberStoredOrder(id: string) {
    try {
      localStorage.setItem(orderKey, id);
      localStorage.removeItem(legacyOrderKey);
      sessionStorage.removeItem(legacyOrderKey);
    } catch { /* Keep tracking in memory. */ }
  }
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
    void fetch('/api/orders').then(async r => {
      if (!r.ok) return;
      const data = await r.json() as { paymentProvider?: 'mock' | 'pay_at_pickup' | 'sadad' };
      if (data.paymentProvider === 'pay_at_pickup') setPaymentMethod('pay_at_pickup');
      else if (data.paymentProvider === 'sadad') setPaymentMethod('sadad');
      else if (data.paymentProvider === 'mock') setPaymentMethod('mock');
    }).catch(() => {});
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (previousStep.current !== step) heading.current?.focus();
    previousStep.current = step;
  }, [step]);
  useEffect(() => {
    let paidId: string | null = returnPaidId ?? null;
    let payFailed = initialPayFailed;
    try {
      const params = new URLSearchParams(window.location.search);
      const paid = params.get('paid');
      if (!paidId && paid && /^SU-[0-9a-f-]{36}$/.test(paid)) paidId = paid;
      if (!payFailed) payFailed = params.get('pay') === 'failed';
      if (paidId || payFailed) {
        const url = new URL(window.location.href);
        url.searchParams.delete('paid');
        url.searchParams.delete('pay');
        window.history.replaceState({}, '', url.pathname + url.search);
      }
      if (paidId) clearReceiptDismissed(paidId);
    } catch { /* Keep recovery via localStorage. */ }
    const storedFromPay = paidId;
    let stored: string | null = storedFromPay;
    let cancel = false;
    const finish = (next?: Step) => {
      void Promise.resolve().then(() => {
        if (cancel) return;
        if (next) setStep(next);
        setRecovering(false);
      });
    };
    if (!stored) stored = readStoredOrderId();
    if (!stored || !/^SU-[0-9a-f-]{36}$/.test(stored)) {
      finish(returnMode ? (payFailed ? 'review' : 'menu') : undefined);
      return () => { cancel = true; };
    }
    void fetch(`/api/orders/${stored}`, { cache: 'no-store' }).then(async (response) => {
      if (cancel) return;
      if (!response.ok) {
        if (response.status === 404 || response.status === 401) forgetStoredOrder();
        finish(returnMode ? (payFailed ? 'review' : 'menu') : undefined);
        return;
      }
      const saved = await response.json() as Receipt;
      if (cancel) return;
      const receiptBranch = saved.details?.branchId;
      if (receiptBranch && receiptBranch !== branchId) {
        forgetStoredOrder();
        finish(returnMode ? (payFailed ? 'review' : 'menu') : undefined);
        return;
      }
      if (!shouldResumeCustomerReceipt(saved)) {
        forgetStoredOrder();
        finish(returnMode ? (payFailed ? 'review' : 'menu') : undefined);
        return;
      }
      setReceipt(saved);
      rememberStoredOrder(saved.id);
      if (saved.paymentStatus === 'paid' || saved.paymentMethod === 'pay_at_pickup') {
        cart.clear();
        attempt.current = null;
        // Fresh Sadad return always opens the receipt. An explicit Back to menu
        // dismisses it for this tab so remounting the branch menu does not yank back.
        if (storedFromPay || !isReceiptDismissed(saved.id)) setStep('receipt');
      } else if (saved.paymentStatus === 'awaiting_payment' && (saved.paymentMethod === 'mock' || saved.paymentMethod === 'sadad')) {
        // Never auto-enter payment on a cold branch visit — that re-fires hosted
        // checkout and dumps the customer straight onto Sadad. Resume from review
        // only after an explicit failed-return (`?pay=failed`) or CTA click.
        if (saved.details?.customer) {
          const restored = { ...emptyCustomer, ...saved.details.customer };
          setCustomer(restored);
          customerDraft.current = restored;
        }
        const held = saved.details?.coupon;
        if (held?.code && held.discountMinor > 0) {
          setAppliedCoupon({
            code: held.code,
            discountMinor: held.discountMinor,
            totalMinor: saved.totalMinor,
            subtotalMinor: saved.totalMinor + held.discountMinor,
          });
        }
        if (payFailed) {
          setPayFailNotice(paymentFailNoticeKind(Number(saved.failedPaymentCount ?? 0)));
        }
        if (payFailed || returnMode) setStep('review');
      }
      // Clear recovering in this turn so a Strict Mode / HMR remount cannot leave
      // the success path stuck on "Confirming your order…".
      setRecovering(false);
    }).catch(() => {
      finish(returnMode ? (payFailed ? 'review' : 'menu') : undefined);
    });
    return () => {
      cancel = true;
    };
  }, []);
  useEffect(() => {
    if (!['receipt', 'menu'].includes(step) || !receipt?.id) return;
    if (!shouldResumeCustomerReceipt(receipt)) {
      forgetStoredOrder();
      return;
    }
    rememberStoredOrder(receipt.id);
    if (isTerminalCustomerStatus(receipt.status)) return;
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
    if (next === 'menu' && receipt && isTerminalCustomerStatus(receipt.status)) {
      forgetStoredOrder();
      setReceipt(null);
    }
    if (
      next === 'menu'
      && receipt
      && (receipt.paymentStatus === 'paid' || receipt.paymentMethod === 'pay_at_pickup')
    ) {
      markReceiptDismissed(receipt.id);
    }
    if (next === 'menu' && returnMode) {
      router.replace(`/${branchId}`);
      return;
    }
    const order: Step[] = ['menu', 'details', 'review', 'payment', 'receipt'];
    setMotion(order.indexOf(next) < order.indexOf(step) ? 'back' : 'forward');
    setError(''); setRedirecting(false); setStep(next); window.scrollTo({ top: 0, behavior: 'instant' });
  }
  /** Stay on review; button shows Redirecting… while we POST the hosted form. */
  async function beginSadadPay(orderId: string) {
    if (!status?.open) { setError(errorMessage('CLOSED')); return; }
    setRedirecting(true);
    setError('');
    try {
      const response = await fetch(`/api/orders/${orderId}/pay/begin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: lang === 'ar' ? 'ar' : 'en' }),
      });
      const data = await response.json() as Parameters<typeof submitHostedCheckout>[0] & { code?: string };
      if (!response.ok) {
        setError(errorMessage(data.code || 'NETWORK'));
        setRedirecting(false);
        return;
      }
      submitHostedCheckout(data);
    } catch {
      setError(errorMessage('NETWORK'));
      setRedirecting(false);
    }
  }
  const errorMessage = (code: string) => ({
    CLOSED: text('This branch has closed. Your basket is saved.', 'هذا الفرع مغلق الآن. سلتك محفوظة.'),
    PRICE_CHANGED: text('A price has changed. Refresh the menu and review your basket before continuing.', 'تغيّر أحد الأسعار. حدّث القائمة وراجع سلتك قبل المتابعة.'),
    UNAVAILABLE: text('An item is no longer available. Refresh the menu to update your basket.', 'أحد الأصناف لم يعد متوفراً. حدّث القائمة لتحديث سلتك.'),
    OPTIONS: text('Some choices have changed. Refresh the menu and edit the affected item.', 'تغيّرت بعض الخيارات. حدّث القائمة وعدّل الصنف.'),
    LIMIT: text('The order limit was reached. Reduce the quantity or try again later.', 'تم الوصول إلى الحد المسموح. قلّل الكمية أو حاول لاحقاً.'),
    CONFLICT: text('This checkout attempt has changed. Return to review and try again.', 'تغيّرت محاولة الدفع هذه. عُد للمراجعة وحاول مجدداً.'),
    ORDERING_UNAVAILABLE: text('Ordering is unavailable right now. Your basket is still here.', 'الطلب غير متاح الآن. سلتك ما زالت محفوظة.'),
  }[code] ?? knownCouponMessage(code, text) ?? text('We couldn’t continue. Check your connection and try again. Your details are still here.', 'تعذّرت المتابعة. تحقق من الاتصال وحاول مجدداً. بياناتك ما زالت محفوظة.'));
  async function checkout() {
    if (busyRef.current || redirecting || couponPending || !branch || !status?.open || !cart.lines.length || cart.unavailableCount > 0) return;
    busyRef.current = true; setBusy(true); setError('');
    try {
      const session = await fetch('/api/orders');
      if (!session.ok) { setError(errorMessage('ORDERING_UNAVAILABLE')); return; }
      const subtotalMinor = Math.round(cart.totalQar * 100);
      const couponCode = appliedCoupon?.subtotalMinor === subtotalMinor ? appliedCoupon.code : undefined;
      const body = JSON.stringify({ branchId, customer, paymentMethod, ...(couponCode ? { couponCode } : {}), lines: cart.lines.map(line => ({ dishId: line.dish.id, selection: line.sel, quantity: line.qty, note: line.note, expectedUnitMinor: Math.round(line.unitQar * 100) })) });
      if (attempt.current?.body !== body) {
        // crypto.randomUUID is unavailable on an HTTP LAN preview; getRandomValues works there.
        const bytes = crypto.getRandomValues(new Uint8Array(20));
        attempt.current = { body, key: Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('') };
      }
      const res = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': attempt.current.key }, body });
      const data = await res.json();
      if (!res.ok) { setError(errorMessage(data.code)); return; }
      setReceipt(data); rememberStoredOrder(data.id);
      const confirmedNow = data.paymentMethod === 'pay_at_pickup' || data.paymentStatus === 'paid';
      if (confirmedNow) { cart.clear(); attempt.current = null; go('receipt'); return; }
      if (data.paymentMethod === 'sadad') {
        // Leave review visible; CTA flips to Redirecting… then posts to Sadad.
        await beginSadadPay(data.id);
        return;
      }
      go('payment');
    } catch { setError(errorMessage('NETWORK')); }
    finally { setBusy(false); busyRef.current = false; }
  }
  const branchName = branch ? text(branch.name, branch.nameAr) : '';
  const activeReceipt = receipt && shouldResumeCustomerReceipt(receipt) ? receipt : null;
  const activeStep = step === 'receipt' && !activeReceipt ? 'menu' : step;
  const viewStep: Step = activeStep === 'payment' && status && !status.open ? 'review' : activeStep;
  const confirmed = activeReceipt && (activeReceipt.paymentStatus === 'paid' || activeReceipt.paymentMethod === 'pay_at_pickup');
  const placedMatchesCart = Boolean(
    activeReceipt?.details?.lines
    && cartMatchesPlaced(
      cart.lines.map((line) => ({
        dishId: line.dish.id,
        selection: line.sel,
        quantity: line.qty,
        note: line.note,
        unitMinor: Math.round(line.unitQar * 100),
      })),
      activeReceipt.details.lines.map((line) => ({
        dishId: line.dishId,
        selection: line.selection,
        quantity: line.quantity,
        note: line.note,
        unitMinor: line.unitMinor,
      })),
    ),
  );
  // Resume only when the live basket still matches the unpaid placed order.
  const resumePay = Boolean(
    activeReceipt
    && activeReceipt.paymentStatus === 'awaiting_payment'
    && (activeReceipt.paymentMethod === 'mock' || activeReceipt.paymentMethod === 'sadad')
    && placedMatchesCart,
  );
  const payRetryBlocked = resumePay && payFailNotice === 'later';
  const payFailCopyShown = resumePay && payFailNotice ? paymentFailCopy(payFailNotice, text) : null;
  const menuStage = branch ? <div key="menu-stage" className={`app-lock ordering-menu-stage${activeStep !== 'menu' ? ' is-inactive' : ''}`} inert={activeStep !== 'menu'} aria-hidden={activeStep !== 'menu' ? true : undefined}><MenuFeed branch={branchName} inactive={activeStep !== 'menu'} onPickup={() => go('details')}
    orderTracking={confirmed && activeReceipt ? <button type="button" className={`order-tracker is-${orderPhase(activeReceipt.status)}`} aria-live="polite" onClick={() => go('receipt')}>
      <span className="order-tracker-label">{orderTrackingLabel(activeReceipt.status, lang)}</span>{activeReceipt.orderNumber != null && <span className="order-tracker-number" dir="ltr">#{formatOrderNumber(activeReceipt.orderNumber)}</span>}
    </button> : resumePay && activeReceipt ? <button type="button" className="order-tracker is-awaiting" aria-live="polite" onClick={() => go('review')}>
      <span className="order-tracker-label">{text('Finish payment', 'أكمل الدفع')}</span>{activeReceipt.orderNumber != null && <span className="order-tracker-number" dir="ltr">#{formatOrderNumber(activeReceipt.orderNumber)}</span>}
    </button> : undefined} /></div> : null;
  if (recovering) {
    return (
      <div className="ordering-page" data-step="receipt" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <main id="main" className="checkout-main">
          <p role="status">{text('Confirming your order…', 'جارٍ تأكيد طلبك…')}</p>
        </main>
      </div>
    );
  }
  if (activeStep === 'menu') return <>{menuStage}</>;
  const receiptCustomer = activeReceipt?.details ? activeReceipt.details.customer ?? emptyCustomer : customer;
  const receiptBranch = branches.find(b => b.slug === activeReceipt?.details?.branchId) ?? branch;
  const receiptBranchName = receiptBranch ? text(receiptBranch.name, receiptBranch.nameAr) : branchName;
  const receiptLines = activeReceipt?.details?.lines.map(line => ({ key: line.id, displayName: pickName(line, lang),
    meta: line.kind ? selectionLabel({ ...line, kind: line.kind }, line.selection, lang, t) : '',
    note: line.note, qty: line.quantity, lineTotal: line.totalMinor / 100,
  })) ?? cart.lines;
  const title = viewStep === 'details' ? text('Collection details', 'بيانات الاستلام')
    : viewStep === 'review' ? text('Review your order', 'راجع طلبك')
    : viewStep === 'receipt' ? text('Your order', 'طلبك') : text('Payment', 'الدفع');
  const count = cart.itemCount;
  const subtotalMinor = Math.round(cart.totalQar * 100);
  const couponQuote = appliedCoupon?.subtotalMinor === subtotalMinor ? appliedCoupon : null;
  const branchOpen = Boolean(status?.open);
  const closedNotice = status && !branchOpen ? <div className="checkout-notice" role="status"><strong>{text('This branch is currently closed', 'هذا الفرع مغلق حالياً')}</strong><p>{text('Order when the branch opens. Your basket is saved.', 'اطلب عندما يفتح الفرع. سلتك محفوظة.')}</p></div> : null;
  function ticket(editable: boolean, canEditBasket = false, serverMinor?: number) { return <section className="ticket checkout-ticket" aria-label={t.yourTicket}>
    <div className="ticket-scallop" aria-hidden="true" />
    <header className="ticket-head"><div><p className="ticket-kicker">{t.brand}</p><h2 className="ticket-title">{t.yourTicket}</h2></div>{canEditBasket ? <button type="button" className="ticket-edit" onClick={() => go('menu')}>{text('Edit items', 'تعديل الأصناف')}</button> : <span className="ticket-count">{count} {text(count === 1 ? 'item' : 'items', 'صنف')}</span>}</header>
    <p className="ticket-rule" aria-hidden="true" />
    <ul className="ticket-lines">{cart.lines.map(line => <li key={line.key} className="ticket-line">
      <div className="line-main"><p className="line-name">{line.displayName}</p>{line.meta && <p className="line-meta">{line.meta}</p>}{line.qty > 1 && <p className="line-meta line-unit">{line.qty} <span className="qty-times" aria-hidden="true">×</span> {ticketMoney(line.unitQar)}</p>}{line.note && <p className="line-note">{t.commentWord}: {line.note}</p>}{editable && <button type="button" className="ticket-edit" onClick={() => setEditing(line)}>{text('Edit choices & notes', 'تعديل الخيارات والملاحظات')}</button>}</div>
      {editable ? <div className="line-qty"><button type="button" className="qty-btn" onClick={() => cart.dec(line.key)} aria-label={t.fewerOf(line.displayName)}>−</button><span className="qty-num">{line.qty}</span><button type="button" className="qty-btn" onClick={() => cart.inc(line.key)} disabled={line.qty >= 20} aria-label={t.moreOf(line.displayName)}>+</button></div> : <span className="ticket-static-qty" dir="ltr" aria-label={text(`Quantity ${line.qty}`, `الكمية ${line.qty}`)}><span className="qty-times" aria-hidden="true">×</span>{line.qty}</span>}
      <p className="line-total">{ticketMoney(line.lineTotal)}</p>
    </li>)}</ul>
    <CouponField subtotalMinor={subtotalMinor} applied={couponQuote} text={text} onApplied={setAppliedCoupon} onPending={setCouponPending} onRemove={() => setAppliedCoupon(null)} />
    {couponQuote && <p className="order-discount ticket-coupon-discount"><span>{text('Discounts', 'الخصومات')}</span><span dir="ltr">−{money(couponQuote.discountMinor)}</span></p>}
    <div className="ticket-sum"><span>{t.total}</span><strong>{couponQuote ? money(couponQuote.totalMinor) : serverMinor != null ? money(serverMinor) : ticketMoney(cart.totalQar)}</strong></div>
  </section>; }
  const receiptBody = (editable: boolean, serverMinor?: number) => <>
    {ticket(false, editable, serverMinor)}
    <details className="customer-fold review-details">
      <summary><span>{text('Your details', 'بياناتك')}</span>{editable && <button type="button" className="text-action" onClick={event => { event.preventDefault(); event.stopPropagation(); go('details'); }}>{text('Edit', 'تعديل')}</button>}</summary>
      <div className="customer-fold-body"><p className="order-who"><strong>{customer.name}</strong><span dir="ltr" className="review-phone">{displayPhone(customer.phone)}</span></p><div className="vehicle-pair"><QatarPlate plate={customer.plate} /><p className="review-vehicle"><CarBrandLogo brand={findCarBrand(customer.brand)} /><span>{[customer.colour, carBrandName(customer.brand, lang)].filter(Boolean).join(' · ')}</span></p></div>{customer.instructions && <p className="checkout-note">{customer.instructions}</p>}</div>
    </details>
  </>;
  if (viewStep === 'payment' && activeReceipt && activeReceipt.paymentMethod === 'mock') return <>{menuStage}<MockSadadGateway amount={money(activeReceipt.totalMinor)} lang={lang} onBack={() => go('review')} onComplete={() => go('receipt')} onPay={async () => {
    const response = await fetch(`/api/orders/${activeReceipt.id}/mock-pay`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const result = await response.json();
    if (!response.ok || result.paymentStatus !== 'paid') throw new Error(errorMessage(result.code || 'NETWORK'));
    setReceipt(current => ({ ...current, ...result }));
    cart.clear(); attempt.current = null;
  }} /></>;
  return <>{menuStage}<div className="ordering-page" data-step={viewStep} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
    <div className="ordering-content" inert={Boolean(editing)}>
      <header className="ordering-header"><button type="button" className="ordering-logo" onClick={() => go('menu')} aria-label={text('Back to the menu', 'العودة إلى القائمة')}><Image src={menu.settings.logo} width={59} height={55} alt={t.brand} unoptimized /></button><LangButton /></header>
      <>
        {viewStep !== 'receipt' && <div className="checkout-navigation">
          <button type="button" className="text-action" disabled={busy || redirecting} onClick={() => go(viewStep === 'details' ? 'menu' : viewStep === 'review' ? 'details' : 'review')}>
            <span className="back-arrow" aria-hidden="true">←</span> {text('Back', 'رجوع')}
          </button>
          {(['details', 'review'] as Step[]).includes(viewStep) && <span aria-label={text(`Step ${['details', 'review'].indexOf(viewStep) + 1} of 2`, `الخطوة ${['details', 'review'].indexOf(viewStep) + 1} من ٢`)}>{['details', 'review'].indexOf(viewStep) + 1} / 2</span>}
        </div>}
        <main id="main" className={`checkout-main${viewStep === 'details' || viewStep === 'review' || viewStep === 'receipt' ? ' has-step-action' : ''}`}>
          {/*
            Keep the fixed CTA outside `.checkout-step`. Step enter/back animations use
            transform, which would otherwise reparent `position: fixed` and make the
            primary button slide from mid-screen down to the bottom on every step change.
          */}
          <div className="checkout-step" data-motion={motion} key={viewStep}>
            <h1 ref={heading} tabIndex={-1}>{title}</h1>
            {(viewStep === 'details' || viewStep === 'review') && <p className="checkout-branch">{text('Pickup', 'استلام')} · <strong>{branchName}</strong></p>}
            {viewStep !== 'payment' && viewStep !== 'receipt' && closedNotice}
            {viewStep === 'review' && payFailCopyShown && (
              <div className="checkout-notice checkout-notice-fail" role="alert">
                <strong>{payFailCopyShown.title}</strong>
                <p>{payFailCopyShown.body}</p>
              </div>
            )}
            {viewStep !== 'receipt' && cart.unavailableCount > 0 && <div className="checkout-notice" role="alert"><strong>{text('Your basket needs an update', 'تحتاج سلتك إلى تحديث')}</strong><p>{text(`${cart.unavailableCount} serving(s) or their choices are no longer available. Remove them before continuing.`, `${cart.unavailableCount} حصة أو خياراتها لم تعد متوفرة. احذفها قبل المتابعة.`)}</p><button type="button" className="text-action" onClick={cart.discardUnavailable}>{text('Remove unavailable selections', 'حذف الخيارات غير المتوفرة')}</button></div>}
            {viewStep === 'details' && (
              <CollectionDetailsForm
                initial={customerDraft.current}
                lang={lang}
                text={text}
                onDraft={(next) => { customerDraft.current = next; }}
                onValid={(next) => {
                  customerDraft.current = next;
                  setCustomer(next);
                  go('review');
                }}
              />
            )}
            {viewStep === 'review' && (resumePay && activeReceipt?.details?.lines?.length
              ? <>
                <section className="ticket checkout-ticket" aria-label={t.yourTicket}>
                  <div className="ticket-scallop" aria-hidden="true" />
                  <header className="ticket-head"><div><p className="ticket-kicker">{t.brand}</p><h2 className="ticket-title">{t.yourTicket}</h2></div><span className="ticket-count">{activeReceipt.details.lines.reduce((n, line) => n + line.quantity, 0)} {text('items', 'صنف')}</span></header>
                  <p className="ticket-rule" aria-hidden="true" />
                  <ul className="ticket-lines">{activeReceipt.details.lines.map(line => <li key={line.id} className="ticket-line">
                    <div className="line-main"><p className="line-name">{pickName(line, lang)}</p>{line.note && <p className="line-note">{t.commentWord}: {line.note}</p>}</div>
                    <span className="ticket-static-qty" dir="ltr" aria-label={text(`Quantity ${line.quantity}`, `الكمية ${line.quantity}`)}><span className="qty-times" aria-hidden="true">×</span>{line.quantity}</span>
                    <p className="line-total">{ticketMoney(line.totalMinor / 100)}</p>
                  </li>)}</ul>
                  {(activeReceipt.details.discountMinor ?? 0) > 0 && <p className="order-discount ticket-coupon-discount"><span>{text('Discounts', 'الخصومات')}</span><span dir="ltr">−{money(activeReceipt.details.discountMinor)}</span></p>}
                  {activeReceipt.details.coupon?.code && <p className="order-coupon-code" dir="ltr">{activeReceipt.details.coupon.code}</p>}
                  <div className="ticket-sum"><span>{t.total}</span><strong>{money(activeReceipt.totalMinor)}</strong></div>
                </section>
                <details className="customer-fold review-details">
                  <summary><span>{text('Your details', 'بياناتك')}</span></summary>
                  <div className="customer-fold-body"><p className="order-who"><strong>{customer.name}</strong><span dir="ltr" className="review-phone">{displayPhone(customer.phone)}</span></p><div className="vehicle-pair"><QatarPlate plate={customer.plate} /><p className="review-vehicle"><CarBrandLogo brand={findCarBrand(customer.brand)} /><span>{[customer.colour, carBrandName(customer.brand, lang)].filter(Boolean).join(' · ')}</span></p></div>{customer.instructions && <p className="checkout-note">{customer.instructions}</p>}</div>
                </details>
              </>
              : receiptBody(true))}
            {viewStep === 'receipt' && activeReceipt && <div data-order-id={activeReceipt.id}>
              <header className="order-status">
                <p className="order-confirmed" role="status">{activeReceipt.paymentMethod === 'pay_at_pickup' ? text('Order received', 'تم استلام الطلب') : text('Payment confirmed', 'تم تأكيد الدفع')}</p>
                {activeReceipt.orderNumber != null && <p className="order-number" dir="ltr"><span>{text('Order number', 'رقم الطلب')}</span>{formatOrderNumber(activeReceipt.orderNumber)}</p>}
              </header>
              <OrderProgress status={activeReceipt.status} lang={lang} />
              {activeReceipt.status === 'ready' && !activeReceipt.arrivedAt && <div className="order-arrived-action">
                <button type="button" className="checkout-primary order-arrived-button" disabled={busy} onClick={() => {
                  if (busyRef.current) return;
                  busyRef.current = true; setBusy(true); setError('');
                  void fetch(`/api/orders/${activeReceipt.id}/arrived`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: '{}',
                  }).then(async (response) => {
                    const body = await response.json() as Receipt & { code?: string };
                    if (!response.ok) throw new Error(body.code || 'NETWORK');
                    setReceipt((current) => current ? { ...current, ...body, details: body.details ?? current.details } : body);
                  }).catch(() => setError(text('Unable to notify the kitchen. Please try again.', 'تعذّر إبلاغ المطبخ. يرجى المحاولة مجدداً.')))
                    .finally(() => { busyRef.current = false; setBusy(false); });
                }}>{busy ? text('Notifying…', 'جارٍ الإبلاغ…') : text("I've arrived", 'لقد وصلت')}</button>
                <p>{text('Tap when you are at the branch for pickup.', 'اضغط عندما تصل إلى الفرع للاستلام.')}</p>
              </div>}
              {activeReceipt.status === 'ready' && activeReceipt.arrivedAt && <p className="order-arrived-note" role="status">{text('Kitchen notified. Stay in your car.', 'تم إبلاغ المطبخ. يرجى البقاء في سيارتك.')}</p>}
              <section className="order-pickup">
                <div className="confirmation-branch"><p className="checkout-branch">{text('Pickup', 'استلام')} · <strong>{receiptBranchName}</strong></p>
                  {receiptBranch && <a className="branch-call" href={`tel:${receiptBranch.phone}`} aria-label={text(`Call ${receiptBranchName} branch`, `اتصل بفرع ${receiptBranchName}`)}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m7 3 3 5-2 2c1.3 2.7 3.3 4.7 6 6l2-2 5 3v3c0 1-1 2-2 2C9.6 21.4 2.6 14.4 2 5c0-1 1-2 2-2h3Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    {text('Call', 'اتصال')}
                  </a>}</div>
                {receiptBranch && <DirectionsLink branchName={receiptBranchName} href={receiptBranch.mapsUrl} text={text} />}
              </section>
              <h2 className="order-items-title">{text('Your order', 'طلبك')}</h2>
              <ul className="order-summary">{receiptLines.map(line => <li key={line.key}><span><b>{line.displayName}</b>{line.meta && <small>{line.meta}</small>}{line.note && <small>{line.note}</small>}</span><span className="order-qty" dir="ltr"><span className="qty-times" aria-hidden="true">×</span>{line.qty}</span><span dir="ltr">{ticketMoney(line.lineTotal)}</span></li>)}</ul>
              {(activeReceipt.details?.discountMinor ?? 0) > 0 && <p className="order-discount"><span>{text('Discounts', 'الخصومات')}</span><span dir="ltr">−{money(activeReceipt.details!.discountMinor)}</span></p>}
              {activeReceipt.details?.coupon?.code && <p className="order-coupon-code" dir="ltr">{activeReceipt.details.coupon.code}</p>}
              <p className="order-total"><span>{t.total}</span><strong dir="ltr">{money(activeReceipt.totalMinor)}</strong></p>
              <details className="customer-fold order-collection">
                <summary><span>{text('Your details', 'بياناتك')}</span></summary>
                <div className="customer-fold-body">
                  <p className="order-who"><strong>{receiptCustomer.name}</strong><span dir="ltr">{displayPhone(receiptCustomer.phone)}</span></p>
                  <div className="vehicle-pair">
                    {/^[QTR]\d{3,6}$/.test(receiptCustomer.plate) && <QatarPlate plate={receiptCustomer.plate} />}
                    {receiptCustomer.brand && <p className="order-vehicle review-vehicle"><CarBrandLogo brand={findCarBrand(receiptCustomer.brand)} /><span>{[receiptCustomer.colour, carBrandName(receiptCustomer.brand, lang)].filter(Boolean).join(' · ')}</span></p>}
                  </div>
                </div>
              </details>
            </div>}
            {error && <div className="checkout-error" role="alert"><p>{error}</p><button className="text-action" type="button" onClick={() => { go('menu'); router.refresh(); }}>{text('Refresh menu', 'تحديث القائمة')}</button></div>}
          </div>
          {viewStep === 'details' && <div className="checkout-step-action"><button type="submit" form="collection-details" className="checkout-primary" disabled={!count || cart.unavailableCount > 0}>{text('Review order', 'مراجعة الطلب')}<Forward /></button></div>}
          {viewStep === 'review' && <div className="checkout-step-action"><button type="button" className="checkout-primary" disabled={busy || redirecting || couponPending || !branchOpen || payRetryBlocked || (!resumePay && (!count || cart.unavailableCount > 0))} onClick={() => {
            if (!branchOpen || payRetryBlocked) return;
            if (resumePay && activeReceipt?.paymentMethod === 'sadad') void beginSadadPay(activeReceipt.id);
            else if (resumePay) go('payment');
            else void checkout();
          }}>{!branchOpen ? text('Order when the branch opens', 'اطلب عندما يفتح الفرع') : payRetryBlocked ? text('Try again later', 'حاول لاحقاً') : redirecting ? text('Redirecting…', 'جارٍ التحويل…') : busy ? text('Checking…', 'جارٍ التحقق…') : resumePay || paymentMethod !== 'pay_at_pickup' ? text('Continue to payment', 'المتابعة إلى الدفع') : text('Place order · pay at pickup', 'تأكيد الطلب · الدفع عند الاستلام')}{branchOpen && !redirecting && !busy && !payRetryBlocked && <Forward />}</button></div>}
          {viewStep === 'receipt' && <div className="checkout-step-action"><button type="button" className="checkout-primary" onClick={() => go('menu')}><span><span className="back-arrow" aria-hidden="true">←</span> {text('Back to menu', 'العودة للقائمة')}</span></button></div>}
        </main>
      </>
      <footer className="ordering-footer"><span>Sushinaa</span></footer>
    </div>
    {editing && <DishDetailSheet dish={editing.dish} ordering initialEntries={Array.from({ length: editing.qty }, () => ({ sel: editing.sel, note: editing.note }))} onSave={entries => cart.replace(editing.key, entries)} onClose={() => setEditing(null)} />}
  </div></>;
}
function QatarPlate({ plate }: { plate: string }) { return <div className="plate-card" dir="ltr" aria-label={`Qatar plate ${plate[0]} ${plate.slice(1)}`}><span className="plate-country"><span className="plate-flag" aria-hidden="true">🇶🇦</span><span>QATAR<br /><span lang="ar">قطر</span></span></span><strong className="plate-digits">{plate.slice(1)}</strong><strong className="plate-letter">{plate[0]}</strong></div>; }
function DirectionsLink({ branchName, href, text }: { branchName: string; href: string; text: (en: string, ar: string) => string }) { return <a className="directions-link" href={href} target="_blank" rel="noopener noreferrer" aria-label={text(`Open Google Maps directions to ${branchName}`, `افتح خرائط Google للوصول إلى ${branchName}`)}><span className="directions-pin" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z" stroke="currentColor" strokeWidth="1.6"/><circle cx="12" cy="10" r="2.3" stroke="currentColor" strokeWidth="1.6"/></svg></span><span className="directions-copy"><strong>{text('Get directions', 'اتجاهات الوصول')}</strong><small>{branchName} · Google Maps</small></span><span className="directions-arrow" aria-hidden="true">↗</span></a>; }
function Forward() { return <span className="forward-arrow" aria-hidden="true">→</span>; }
