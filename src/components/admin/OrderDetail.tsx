'use client';
import { useEffect, useState } from 'react';
import { BRANCHES } from '@/branches/branches';
import { useLocale } from '@/i18n/locale';
import { useNotify } from './Notices';
import { allowedTransitions, staffStatus, staffLabels, type OrderStatus } from '@/ordering/status';
import { formatMinor } from '@/lib/money';
import { nationalPhone } from '@/ordering/checkout/validation';
import { printTicket } from './print-ticket';
import { OrderEditPanel } from './OrderEditPanel';
import { cancellationReasons, type OrderDetailData } from '@/ordering/contracts';
import type { Role } from '@/cms/permissions';
import type { MenuData } from '@/cms/schema';

function choiceText(selection: OrderDetailData['currentLines'][number]['selection']) {
  return Object.values(selection).flatMap((value) => Array.isArray(value) ? value : typeof value === 'string' && value ? [value] : typeof value === 'number' ? [String(value)] : []).join(', ');
}

export function OrderDetail({ id, onBack, onChange, role, menu }: { id: string; onBack: () => void; onChange: () => void; role: Role; menu: MenuData }) {
  const { lang, t } = useLocale();
  const text = (en: string, ar: string) => lang === 'ar' ? ar : en;
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
      <header className="staff-detail-head">
        <h2>{data.orderNumber != null ? text(`Order ${data.orderNumber}`, `الطلب ${data.orderNumber}`) : text('Order', 'الطلب')}</h2>
        <div className="staff-head-actions">
          <span className="staff-status">{staffLabels[staffStatus(data.status)][lang]}</span>
          {allowedTransitions(data.status, data.paidAt).filter((to) => to !== 'cancelled' && to !== 'refunded').slice(0, 1).map((to) => <button key={to} type="button" disabled={busy} className="primary" onClick={() => void change(to)}>
            {to === 'completed' && data.paymentMethod === 'pay_at_pickup' ? text('Mark paid & collected', 'تأكيد الدفع والاستلام') : to === 'accepted' ? text('Accept order', 'قبول الطلب') : staffLabels[staffStatus(to)][lang]}
          </button>)}
          {role === 'admin' && allowedTransitions(data.status, data.paidAt).includes('refunded') && <button type="button" disabled={busy} onClick={() => void change('refunded')}>{text('Refund (mock)', 'استرداد المبلغ (تجريبي)')}</button>}
          {allowedTransitions(data.status, data.paidAt).includes('cancelled') && <button type="button" className="danger" disabled={busy} onClick={() => setCancel(true)}>{text('Cancel order…', 'إلغاء الطلب…')}</button>}
        </div>
      </header>
      <dl className="order-facts">
        <div><dt>{text('Name', 'الاسم')}</dt><dd>{data.customer.name || '—'}</dd></div>
        <div><dt>{text('Phone', 'الجوال')}</dt><dd dir="ltr">{nationalPhone(data.customer.phone) || '—'}</dd></div>
        <div><dt>{text('Plate', 'اللوحة')}</dt><dd dir="ltr">{data.customer.plate}</dd></div>
        <div><dt>{text('Branch', 'الفرع')}</dt><dd>{lang === 'ar' ? branch?.nameAr : branch?.name}</dd></div>
        <div><dt>{text('Payment', 'الدفع')}</dt><dd>{data.paymentMethod === 'mock' ? text('Paid (mock)', 'مدفوع (تجريبي)') : data.paidAt ? text('Paid at pickup', 'تم الدفع عند الاستلام') : text('Pay at pickup', 'الدفع عند الاستلام')}</dd></div>
        {(data.customer.colour || data.customer.car) && <div><dt>{text('Vehicle', 'السيارة')}</dt><dd>{[data.customer.colour, data.customer.car].filter(Boolean).join(' · ')}</dd></div>}
        {data.customer.instructions && <div><dt>{text('Instructions', 'التعليمات')}</dt><dd dir="auto">{data.customer.instructions}</dd></div>}
      </dl>
      <div className="staff-order-list"><table>
        <thead><tr>
          <th>{text('Item', 'الصنف')}</th>
          <th>{text('Choices', 'الخيارات')}</th>
          <th>{text('Qty', 'الكمية')}</th>
          <th>{text('Total', 'الإجمالي')}</th>
        </tr></thead>
        <tbody>{data.currentLines.map(line => <tr key={line.id} data-voided={line.voided || undefined}>
          <td>{lang === 'ar' ? line.nameAr || line.name : line.name}{line.note ? <small>{line.note}</small> : null}</td>
          <td>{choiceText(line.selection) || '—'}</td>
          <td>{line.quantity}</td>
          <td dir="ltr">{line.compliment ? text('Comp', 'هدية') : formatMinor(line.unitMinor * line.quantity, lang)}</td>
        </tr>)}</tbody>
      </table></div>
      <p className="order-total"><span>{text('Total', 'الإجمالي')}</span><strong dir="ltr">{formatMinor(data.totalMinor, lang)}</strong></p>
      <div className="order-detail-actions">
        <button type="button" disabled={busy} onClick={() => void printReceipt()}>{text('Receipt', 'الإيصال')}</button>
        <button type="button" disabled={busy} onClick={() => void printNow(data.printCount > 0 ? 'reprint' : 'manual')}>{text('Reprint kitchen', 'إعادة طباعة المطبخ')}</button>
      </div>
      <details className="order-edit-fold"><summary>{text('Edit order', 'تعديل الطلب')}</summary>
        <OrderEditPanel id={id} data={data} role={role} menu={menu} onSaved={async () => { await load(); onChange(); }} onReceipt={() => void printReceipt()} onReprint={() => void printNow(data.printCount > 0 ? 'reprint' : 'manual')} />
      </details>
      {cancel && <form className="admin-confirm" onSubmit={e => { e.preventDefault(); void change('cancelled'); }}>
        <label>{text('Cancellation reason', 'سبب الإلغاء')}<select value={reason} onChange={e => setReason(e.target.value as typeof reason)}>{cancellationReasons.map(r => <option key={r} value={r}>{reasons[r]}</option>)}</select></label>
        <div className="admin-actions"><button className="danger" disabled={busy} type="submit">{text('Confirm cancellation', 'تأكيد الإلغاء')}</button><button type="button" onClick={() => setCancel(false)}>{t.close}</button></div>
      </form>}
      <details className="staff-history"><summary>{text('Order history', 'سجل الطلب')}</summary><ol>{data.history.map((h,i) => <li key={i}><time>{new Date(h.at).toLocaleString(lang, {timeZone:'Asia/Qatar'})}</time> · {staffLabels[staffStatus(h.to)][lang]}{h.reason && ` · ${reasons[h.reason as keyof typeof reasons] || h.reason}`}</li>)}</ol></details>
    </>}
  </section>;
}
