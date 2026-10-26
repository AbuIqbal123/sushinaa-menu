'use client';
import { useEffect, useState } from 'react';
import { BRANCHES } from '@/branches/branches';
import { useMenu } from '@/cms/context';
import { strings } from '@/i18n/copy';
import { useNotify } from './Notices';
import { allowedTransitions, staffStatus, staffLabels, type OrderStatus } from '@/ordering/status';
import { formatMinor } from '@/lib/money';
import { nationalPhone } from '@/ordering/checkout/validation';
import { selectionLabel } from '@/ordering/price';
import type { Dish } from '@/catalog/types';
import { printTicket } from './print-ticket';
import { OrderEditPanel } from './OrderEditPanel';
import { cancellationReasons, type OrderDetailData } from '@/ordering/contracts';
import type { Role } from '@/cms/permissions';
import type { MenuData } from '@/cms/schema';

function spacedPhone(phone: string) {
  const local = nationalPhone(phone);
  return local.length === 8 ? `${local.slice(0, 4)} ${local.slice(4)}` : local;
}
function lineChoices(line: OrderDetailData['currentLines'][number], menu: MenuData, lang: 'en' | 'ar', t: Parameters<typeof selectionLabel>[3]) {
  const stored = line as OrderDetailData['currentLines'][number] & Partial<Pick<Dish, 'kind' | 'freeDips' | 'extras'>>;
  const dish = stored.kind ? stored : menu.dishes.find((item) => item.id === line.dishId);
  if (!dish?.kind) return [];
  return selectionLabel({ kind: dish.kind, freeDips: dish.freeDips, extras: dish.extras }, line.selection, lang, t).split(' · ').map((part) => part.trim()).filter(Boolean);
}

export function OrderDetail({ id, onBack, onChange, role, menu }: { id: string; onBack: () => void; onChange: () => void; role: Role; menu: MenuData }) {
  const { copy } = useMenu();
  const lang = 'en' as const;
  const t = strings(lang, copy);
  const text = (en: string, _ar?: string) => en;
  const notify = useNotify();
  const reasons = { customer_request: text('Customer request', 'طلب العميل'), unavailable: text('Item unavailable', 'الصنف غير متوفر'), duplicate: text('Duplicate order', 'طلب مكرر'), branch_closed: text('Branch closed', 'الفرع مغلق') };
  const [data, setData] = useState<OrderDetailData | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [cancel, setCancel] = useState(false);
  const [reason, setReason] = useState<typeof cancellationReasons[number]>('customer_request');
  async function load(reveal = true) {
    const response = await fetch(`/api/admin/orders/${id}${reveal ? '?contact=1' : ''}`, { cache: 'no-store' });
    const body = await response.json();
    if (!response.ok) throw new Error('LOAD_FAILED');
    setData(body);
  }
  useEffect(() => { let live = true;
    fetch(`/api/admin/orders/${id}?contact=1`, { cache: 'no-store' }).then(async r => { const b = await r.json(); if (!r.ok) throw new Error(b.code); if (live) setData(b); }).catch(() => live && setError('LOAD_FAILED'));
    return () => { live = false; };
  // Refresh contact masking when the language changes.
  }, [id, lang]);
  useEffect(() => {
    if (data?.status !== 'accepted') return;
    let stop = false;
    void postStatus('preparing', 'accepted').then(async () => {
      if (stop) return;
      await load();
      onChange();
    }).catch(() => undefined);
    return () => { stop = true; };
  }, [data?.status, id]);
  async function printReceipt() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const audit = await fetch(`/api/admin/orders/${id}/receipt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (!audit.ok) throw new Error('PRINT_FAILED');
      const frame = document.createElement('iframe');
      frame.style.cssText = 'position:fixed;width:0;height:0;border:0';
      document.body.appendChild(frame);
      const page = await fetch(`/cms/orders/${id}/receipt`, { cache: 'no-store' });
      if (!page.ok) throw new Error('PRINT_FAILED');
      frame.srcdoc = await page.text();
      frame.onload = () => { frame.contentWindow?.print(); window.setTimeout(() => frame.remove(), 1000); };
      notify({ tone: 'ok', text: text('Receipt sent to print', 'تم إرسال الإيصال للطباعة') });
    } catch { setError('PRINT_FAILED'); }
    finally { setBusy(false); }
  }
  async function sendKitchenPrint(mode: 'manual' | 'reprint') {
    const claim = await fetch(`/api/staff/orders/${id}/print`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode }) });
    const body = await claim.json() as { claimId?: string };
    if (!claim.ok || !body.claimId) throw new Error('PRINT_FAILED');
    await printTicket(id);
    const done = await fetch(`/api/staff/orders/${id}/print/done`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ claimId: body.claimId }) });
    if (!done.ok) throw new Error('PRINT_FAILED');
    notify({ tone: 'ok', text: text('Ticket sent to print', 'تم إرسال التذكرة للطباعة') });
    await load(); onChange();
  }
  async function printNow(mode: 'manual' | 'reprint') {
    if (busy) return;
    setBusy(true); setError('');
    try { await sendKitchenPrint(mode); }
    catch { setError('PRINT_FAILED'); }
    finally { setBusy(false); }
  }
  async function postStatus(to: OrderStatus, expected: string, extra: Record<string, unknown> = {}) {
    const response = await fetch(`/api/admin/orders/${id}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to, expected, ...extra }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.code === 'STALE_STATUS' ? 'STALE_STATUS' : 'UPDATE_FAILED');
  }
  async function change(to: OrderStatus) {
    if (!data || busy) return;
    setBusy(true); setError('');
    try {
      await postStatus(to, data.status, {
        ...(to === 'completed' && data.paymentMethod === 'pay_at_pickup' ? { recordPayment: true } : {}),
        ...(to === 'cancelled' ? { reason } : {}),
      });
      let shown: OrderStatus = to;
      if (to === 'accepted') {
        await postStatus('preparing', 'accepted');
        shown = 'preparing';
        await sendKitchenPrint('manual');
      }
      notify({ tone: 'ok', text: text('Order updated', 'تم تحديث الطلب') + ` · ${staffLabels[staffStatus(shown)][lang]}` });
      setCancel(false); await load(); onChange();
    } catch (e) { setError(e instanceof Error && e.message === 'STALE_STATUS' ? 'STALE_STATUS' : e instanceof Error && e.message === 'PRINT_FAILED' ? 'PRINT_FAILED' : 'UPDATE_FAILED'); await load(); }
    finally { setBusy(false); }
  }
  const branch = BRANCHES.find(b => b.slug === data?.branchId);
  return <section className="staff-order-detail" aria-busy={busy}>
    <button onClick={onBack}>← {text('Back to orders', 'العودة إلى الطلبات')}</button>
    {error && <p role="alert" className="staff-error">{error === 'STALE_STATUS' ? text('Another team member updated this order. The latest status is shown.', 'حدّث موظف آخر هذا الطلب. تظهر الحالة الأحدث الآن.') : error === 'LOAD_FAILED' ? text('Unable to load order. Please retry.', 'تعذّر تحميل الطلب. يرجى المحاولة مجدداً.') : error === 'PRINT_FAILED' ? text('Unable to print this ticket. Please retry.', 'تعذّرت طباعة التذكرة. يرجى المحاولة مجدداً.') : text('Unable to update this order. Please retry.', 'تعذّر تحديث الطلب. يرجى المحاولة مجدداً.')}</p>}
    {data && <>
      <article className="kitchen-sheet">
        <header className="staff-detail-head kitchen-head">
          <h2>{data.orderNumber ?? text('Order', 'الطلب')}</h2>
          <span className={`staff-status status-${staffStatus(data.status)}`}>{staffLabels[staffStatus(data.status)][lang]}</span>
        </header>
        <p className="kitchen-who">
          <strong>{data.customer.name || '—'}</strong>
          <span dir="ltr">{spacedPhone(data.customer.phone) || '—'}</span>
          <span dir="ltr">{data.customer.plate}</span>
        </p>
        <p className="kitchen-meta">{[branch?.name, data.paymentMethod === 'mock' || data.paidAt ? text('Paid', 'مدفوع') : text('Pay at pickup', 'الدفع عند الاستلام'), [data.customer.colour, data.customer.car].filter(Boolean).join(' ')].filter(Boolean).join(' · ')}</p>
        {data.customer.instructions && <p className="kitchen-note">{data.customer.instructions}</p>}
        <ul className="kitchen-items">{data.currentLines.map(line => {
          const choices = lineChoices(line, menu, lang, t);
          return <li key={line.id} data-voided={line.voided || undefined}>
            <p className="kitchen-item"><span>{line.quantity > 1 ? `${line.quantity} × ` : ''}{line.name}</span><span dir="ltr">{line.compliment ? text('Comp', 'هدية') : formatMinor(line.unitMinor * line.quantity, lang)}</span></p>
            {choices.length > 0 && <p className="kitchen-choices">{choices.join(', ')}</p>}
            {line.note && <p className="kitchen-note">{line.note}</p>}
          </li>;
        })}</ul>
        <p className="kitchen-total"><span>{text('Total', 'الإجمالي')}</span><strong dir="ltr">{formatMinor(data.totalMinor, lang)}</strong></p>
        {(data.status === 'placed' || data.status === 'paid') && <button type="button" className="primary accept-order" disabled={busy} onClick={() => void change('accepted')}>{text('Accept order', 'قبول الطلب')}</button>}
        {allowedTransitions(data.status, data.paidAt).filter((to) => to !== 'cancelled' && to !== 'refunded' && to !== 'accepted' && staffStatus(to) !== staffStatus(data.status)).slice(0, 1).map((to) => <button key={to} type="button" className="primary accept-order" disabled={busy} onClick={() => void change(to)}>
          {to === 'completed' && data.paymentMethod === 'pay_at_pickup' ? text('Mark paid & collected', 'تأكيد الدفع والاستلام') : staffLabels[staffStatus(to)][lang]}
        </button>)}
        <div className="kitchen-actions">
          <button type="button" disabled={busy} onClick={() => void printReceipt()}>{text('Receipt', 'الإيصال')}</button>
          <button type="button" disabled={busy} onClick={() => void printNow(data.printCount > 0 ? 'reprint' : 'manual')}>{text('Print', 'طباعة')}</button>
          {role === 'admin' && allowedTransitions(data.status, data.paidAt).includes('refunded') && <button type="button" disabled={busy} onClick={() => void change('refunded')}>{text('Refund', 'استرداد')}</button>}
          {allowedTransitions(data.status, data.paidAt).includes('cancelled') && <button type="button" className="danger" disabled={busy} onClick={() => setCancel(true)}>{text('Cancel', 'إلغاء')}</button>}
        </div>
        <details className="order-edit-fold"><summary>{text('Edit order', 'تعديل الطلب')}</summary>
          <OrderEditPanel id={id} data={data} role={role} menu={menu} onSaved={async () => { await load(); onChange(); }} onReceipt={() => void printReceipt()} onReprint={() => void printNow(data.printCount > 0 ? 'reprint' : 'manual')} />
        </details>
        {cancel && <form className="admin-confirm" onSubmit={e => { e.preventDefault(); void change('cancelled'); }}>
          <label>{text('Cancellation reason', 'سبب الإلغاء')}<select value={reason} onChange={e => setReason(e.target.value as typeof reason)}>{cancellationReasons.map(r => <option key={r} value={r}>{reasons[r]}</option>)}</select></label>
          <div className="admin-actions"><button className="danger" disabled={busy} type="submit">{text('Confirm cancellation', 'تأكيد الإلغاء')}</button><button type="button" onClick={() => setCancel(false)}>{t.close}</button></div>
        </form>}
        <details className="staff-history"><summary>{text('Order history', 'سجل الطلب')}</summary><ol>{data.history.map((h,i) => <li key={i}><time>{new Date(h.at).toLocaleString(lang, {timeZone:'Asia/Qatar'})}</time> · {staffLabels[staffStatus(h.to)][lang]}{h.reason && ` · ${reasons[h.reason as keyof typeof reasons] || h.reason}`}</li>)}</ol></details>
      </article>
    </>}
  </section>;
}
