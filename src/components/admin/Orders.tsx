'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BRANCHES } from '@/branches/branches';
import { LangButton, useLocale } from '@/i18n/locale';
import { staffLabels, staffStatus, type StaffStatus } from '@/ordering/status';
import type { OrderSummary } from '@/ordering/contracts';
import { OrderDetail } from './OrderDetail';

type List = { rows: OrderSummary[]; more: boolean; newCount: number };
export function Orders({ active, onUnread }: { active: boolean; onUnread: (n: number) => void }) {
  const { lang } = useLocale();
  const text = (en: string, ar: string) => lang === 'ar' ? ar : en;
  const [branch, setBranch] = useState(''); const [status, setStatus] = useState('');
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [q, setQ] = useState(''); const [search, setSearch] = useState('');
  const [page, setPage] = useState(1); const [data, setData] = useState<List | null>(null);
  const [detail, setDetail] = useState<string | null>(null); const [error, setError] = useState('');
  const [sound, setSound] = useState(false); const [revision, setRevision] = useState(0);
  const latest = useRef<string | null>(null); const unread = useRef(0); const audio = useRef<HTMLAudioElement | null>(null);
  const activeRef = useRef(active); const soundRef = useRef(sound);
  useEffect(() => { activeRef.current = active; if (active) { unread.current = 0; onUnread(0); } }, [active, onUnread]);
  useEffect(() => { soundRef.current = sound; }, [sound]);
  useEffect(() => { audio.current = new Audio('/order-chime.wav');
    const timer = window.setTimeout(() => { try { setSound(localStorage.getItem('sushinaa-order-sound') === 'true'); } catch { /* Optional preference. */ } }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    let live = true; let running = false;
    async function poll(initial = false) {
      if (document.hidden || running) return;
      running = true;
      try {
        const response = await fetch(`/api/admin/orders?${latest.current ? `since=${latest.current}` : 'limit=100'}`, { cache:'no-store' });
        const body: List & {code?: string} = await response.json();
        if (!response.ok) throw new Error(body.code);
        if (!live) return;
        if (body.rows.length) {
          const count = initial ? 0 : latest.current ? body.newCount : body.rows.length;
          latest.current = body.rows[0].id;
          if (count && !activeRef.current) { unread.current += count; onUnread(unread.current); }
          if (count && soundRef.current) void audio.current?.play().catch(() => {});
        }
        if (!initial && activeRef.current) setRevision(v => v + 1);
      } catch { /* List view displays recoverable errors; keep polling. */ }
      finally { running = false; }
    }
    void poll(true);
    const timer = window.setInterval(() => void poll(), 15000);
    const visible = () => { if (!document.hidden) void poll(); };
    document.addEventListener('visibilitychange', visible);
    return () => { live = false; window.clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  }, [onUnread]);
  const refresh = useCallback(() => setRevision(v => v + 1), []);
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    const query = new URLSearchParams({ page: String(page) });
    for (const [k,v] of Object.entries({branch,status,from,to,q:search})) if (v) query.set(k,v);
    fetch(`/api/admin/orders?${query}`, { cache:'no-store', signal:controller.signal }).then(async r => {
      const body = await r.json(); if (!r.ok) throw new Error(body.code); setData(body); setError('');
    }).catch(e => { if (e.name !== 'AbortError') setError(e.message === 'INVALID' ? 'INVALID' : 'LOAD_FAILED'); });
    return () => controller.abort();
  }, [active,branch,status,from,to,search,page,revision]);
  if (!active) return null;
  return <section className="staff-orders" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
    <div className="staff-tools"><LangButton tone="light" /><button aria-pressed={sound} onClick={() => {
      const next = !sound; setSound(next); try { localStorage.setItem('sushinaa-order-sound', String(next)); } catch { /* Optional preference. */ }
      if (next) void audio.current?.play().catch(() => {});
    }}>{sound ? text('Sound on', 'الصوت مفعّل') : text('Enable sound', 'تفعيل الصوت')}</button></div>
    {detail ? <OrderDetail key={detail} id={detail} onBack={() => setDetail(null)} onChange={refresh} /> : <>
      <div className="admin-toolbar staff-filters">
        <label>{text('Branch', 'الفرع')}<select aria-label={text('Order branch', 'فرع الطلب')} value={branch} onChange={e => { setBranch(e.target.value); setPage(1); }}><option value="">{lang === 'ar' ? 'كل الفروع' : 'All branches'}</option>{BRANCHES.map(b => <option key={b.slug} value={b.slug}>{lang === 'ar' ? b.nameAr : b.name}</option>)}</select></label>
        <label>{text('Status', 'الحالة')}<select aria-label={text('Order status', 'حالة الطلب')} value={status} onChange={e => {setStatus(e.target.value);setPage(1);}}><option value="">{text('All statuses', 'كل الحالات')}</option>{(Object.keys(staffLabels) as StaffStatus[]).map(s => <option key={s} value={s}>{staffLabels[s][lang]}</option>)}</select></label>
        <details className="staff-date-filter"><summary>{text('Date & search', 'التاريخ والبحث')}</summary><label>{text('From', 'من')}<input type="date" value={from} onChange={e => {setFrom(e.target.value);setPage(1);}} /></label><label>{text('To', 'إلى')}<input type="date" value={to} onChange={e => {setTo(e.target.value);setPage(1);}} /></label>
          <form onSubmit={e => {e.preventDefault();setSearch(q.trim());setPage(1);}}><label>{text('Order reference or last 4 phone digits', 'مرجع الطلب أو آخر ٤ أرقام من الجوال')}<input value={q} maxLength={39} onChange={e => setQ(e.target.value)} /></label><button>{text('Search', 'بحث')}</button></form>
        </details>
      </div>
      {error && <div role="alert" className="staff-error">{error === 'INVALID' ? text('Check the date range or search by an order reference / last 4 phone digits.', 'تحقق من نطاق التاريخ أو ابحث بمرجع الطلب أو آخر ٤ أرقام من الجوال.') : text('Unable to load orders. Please retry.', 'تعذّر تحميل الطلبات. يرجى المحاولة مجدداً.')} <button onClick={refresh}>{text('Retry', 'إعادة المحاولة')}</button></div>}
      {!error && data?.rows.length === 0 && <p className="admin-empty">{text('No orders here yet.', 'لا توجد طلبات هنا بعد.')}</p>}
      <ul className="staff-order-list" aria-live="polite">{data?.rows.map(row => {const b = BRANCHES.find(b => b.slug === row.branchId);return <li key={row.id}><button onClick={() => setDetail(row.id)} data-order-id={row.id}>
        <div className="staff-row-top"><strong dir="ltr">{row.id.slice(0,11)}</strong><span className={`staff-status status-${staffStatus(row.status)}`}>{staffLabels[staffStatus(row.status)][lang]}</span></div>
        <div>{lang === 'ar' ? b?.nameAr : b?.name}<time>{new Date(row.createdAt).toLocaleTimeString(lang, {timeZone:'Asia/Qatar',hour:'2-digit',minute:'2-digit'})}</time></div>
        <div className="staff-row-contact" dir="ltr"><span>{row.phone}</span><span>{row.plate}</span></div>
        <div><small>{row.paymentMethod === 'mock' ? text('Paid (mock)', 'مدفوع (تجريبي)') : row.paidAt ? text('Paid at pickup', 'تم الدفع عند الاستلام') : text('Pay at pickup', 'الدفع عند الاستلام')}</small><strong>{(row.totalMinor / 100).toFixed(2)} {text('QAR', 'ر.ق')}</strong></div>
      </button></li>;})}</ul>
      {data && (page > 1 || data.more) && <nav className="admin-pager"><button disabled={page === 1} onClick={() => setPage(page - 1)}>{text('Previous', 'السابق')}</button><span>{page}</span><button disabled={!data.more} onClick={() => setPage(page + 1)}>{text('Next', 'التالي')}</button></nav>}
    </>}
  </section>;
}
