'use client';
import { useEffect, useState } from 'react';
import { BRANCHES } from '@/branches/branches';
import { useLocale } from '@/i18n/locale';
import { selectionLabel } from '@/ordering/price';
import { allowedTransitions, isPrintable, staffStatus, staffLabels, type OrderStatus } from '@/ordering/status';
import { printTicket } from './print-ticket';
import { cancellationReasons, type OrderDetailData } from '@/ordering/contracts';

export function OrderDetail({ id, onBack, onChange }: { id: string; onBack: () => void; onChange: () => void }) {
  const { lang, t } = useLocale();
  const text = (en: string, ar: string) => lang === 'ar' ? ar : en;
  const reasons = { customer_request: text('Customer request', 'طلب العميل'), unavailable: text('Item unavailable', 'الصنف غير متوفر'), duplicate: text('Duplicate order', 'طلب مكرر'), branch_closed: text('Branch closed', 'الفرع مغلق') };
  const [data, setData] = useState<OrderDetailData | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [cancel, setCancel] = useState(false);
  const [reason, setReason] = useState<typeof cancellationReasons[number]>('customer_request');
  async function load(reveal = false) {
    const response = await fetch(`/api/admin/orders/${id}${reveal ? '?contact=1' : ''}`, { cache: 'no-store' });
    const body = await response.json();
    if (!response.ok) throw new Error('LOAD_FAILED');
    setData(body);
  }
  useEffect(() => { let live = true;
    fetch(`/api/admin/orders/${id}`, { cache: 'no-store' }).then(async r => { const b = await r.json(); if (!r.ok) throw new Error(b.code); if (live) setData(b); }).catch(() => live && setError('LOAD_FAILED'));
    return () => { live = false; };
  // Refresh contact masking when the language changes.
  }, [id, lang]);
  async function printNow(mode: 'manual' | 'reprint') {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const claim = await fetch(`/api/staff/orders/${id}/print`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode }) });
      const body = await claim.json() as { claimId?: string };
      if (!claim.ok || !body.claimId) throw new Error('PRINT_FAILED');
      await printTicket(id);
      const done = await fetch(`/api/staff/orders/${id}/print/done`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ claimId: body.claimId }) });
      if (!done.ok) throw new Error('PRINT_FAILED');
      await load(); onChange();
    } catch { setError('PRINT_FAILED'); }
    finally { setBusy(false); }
  }
  async function change(to: OrderStatus) {
    if (!data || busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/admin/orders/${id}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, expected: data.status, ...(to === 'completed' && data.paymentMethod === 'pay_at_pickup' ? { recordPayment: true } : {}), ...(to === 'cancelled' ? { reason } : {}) }) });
      const body = await response.json();
      if (!response.ok) { await load(); throw new Error(body.code === 'STALE_STATUS' ? 'STALE_STATUS' : 'UPDATE_FAILED'); }
      setCancel(false); await load(); onChange();
    } catch (e) { setError(e instanceof Error && e.message === 'STALE_STATUS' ? 'STALE_STATUS' : 'UPDATE_FAILED'); }
    finally { setBusy(false); }
  }
  const branch = BRANCHES.find(b => b.slug === data?.branchId);
  const money = (n: number) => `${(n / 100).toFixed(2)} ${text('QAR', 'ر.ق')}`;
  return <section className="staff-order-detail" aria-busy={busy}>
    <button onClick={onBack}>← {text('Back to orders', 'العودة إلى الطلبات')}</button>
    {error && <p role="alert" className="staff-error">{error === 'STALE_STATUS' ? text('Another team member updated this order. The latest status is shown.', 'حدّث موظف آخر هذا الطلب. تظهر الحالة الأحدث الآن.') : error === 'LOAD_FAILED' ? text('Unable to load order. Please retry.', 'تعذّر تحميل الطلب. يرجى المحاولة مجدداً.') : error === 'PRINT_FAILED' ? text('Unable to print this ticket. Please retry.', 'تعذّرت طباعة التذكرة. يرجى المحاولة مجدداً.') : text('Unable to update this order. Please retry.', 'تعذّر تحديث الطلب. يرجى المحاولة مجدداً.')}</p>}
    {data && <>
      <header className="staff-detail-head"><h2 dir="ltr">{data.orderNumber ?? id}</h2><span className="staff-status">{staffLabels[staffStatus(data.status)][lang]}</span></header>
      <p dir="ltr" className="staff-order-ref">{id}</p>
      {isPrintable(data.status) && data.printCount === 0 && <button type="button" className="staff-print" onClick={() => void printNow('manual')}>{text('Print', 'طباعة')}</button>}
      {data.printCount > 0 && <button type="button" className="staff-print" onClick={() => void printNow('reprint')}>{text('Reprint', 'إعادة الطباعة')}</button>}
      <p>{lang === 'ar' ? branch?.nameAr : branch?.name} · {data.paymentMethod === 'mock' ? text('Paid (mock)', 'مدفوع (تجريبي)') : data.paidAt ? text('Paid at pickup', 'تم الدفع عند الاستلام') : text('Pay at pickup', 'الدفع عند الاستلام')}</p>
      <section className="admin-card staff-contact"><strong>{data.customer.name || '—'}</strong>
        <p dir="ltr">{data.customer.phone}</p><p dir="ltr">{data.customer.plate}</p>
        <p>{[data.customer.colour, data.customer.car].filter(Boolean).join(' · ')}</p>
        {data.customer.instructions && <p dir="auto">{data.customer.instructions}</p>}
        {!data.contactRevealed && <button onClick={() => { void load(true).catch(() => setError('LOAD_FAILED')); }}>{text('Show contact', 'إظهار بيانات التواصل')}</button>}
      </section>
      <section className="ticket staff-ticket"><div className="ticket-scallop" aria-hidden="true" /><header className="ticket-head"><h2>{t.yourTicket}</h2></header>
        <ul className="ticket-lines">{data.snapshot.lines.map((line, i) => <li key={i} className="ticket-line">
          <div className="line-main"><p className="line-name">{lang === 'ar' ? line.nameAr || line.name : line.name}</p><p className="line-meta">{selectionLabel(line, line.selection, lang, t)}</p>{line.note && <p className="line-note" dir="auto">{line.note}</p>}</div><span>×{line.quantity}</span><strong>{money(line.totalMinor)}</strong>
        </li>)}</ul><div className="ticket-sum"><span>{t.total}</span><strong>{money(data.totalMinor)}</strong></div>
      </section>
      <div className="staff-status-actions">{allowedTransitions(data.status, data.paidAt).map(to => <button key={to} disabled={busy} className={to === 'cancelled' ? 'danger' : 'primary'} onClick={() => to === 'cancelled' ? setCancel(true) : void change(to)}>
        {to === 'completed' && data.paymentMethod === 'pay_at_pickup' ? text('Mark paid & collected', 'تأكيد الدفع والاستلام') : to === 'accepted' ? text('Accept order', 'قبول الطلب') : to === 'refunded' ? text('Refund (mock)', 'استرداد المبلغ (تجريبي)') : staffLabels[staffStatus(to)][lang]}
      </button>)}</div>
      {cancel && <form className="admin-confirm" onSubmit={e => { e.preventDefault(); void change('cancelled'); }}>
        <label>{text('Cancellation reason', 'سبب الإلغاء')}<select value={reason} onChange={e => setReason(e.target.value as typeof reason)}>{cancellationReasons.map(r => <option key={r} value={r}>{reasons[r]}</option>)}</select></label>
        <div className="admin-actions"><button className="danger" disabled={busy} type="submit">{text('Confirm cancellation', 'تأكيد الإلغاء')}</button><button type="button" onClick={() => setCancel(false)}>{t.close}</button></div>
      </form>}
      <details className="staff-history"><summary>{text('Order history', 'سجل الطلب')}</summary><ol>{data.history.map((h,i) => <li key={i}><time>{new Date(h.at).toLocaleString(lang, {timeZone:'Asia/Qatar'})}</time> · {staffLabels[staffStatus(h.to)][lang]}{h.reason && ` · ${reasons[h.reason as keyof typeof reasons] || h.reason}`}</li>)}</ol></details>
    </>}
  </section>;
}
