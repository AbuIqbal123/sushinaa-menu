'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BRANCHES } from '@/branches/branches';
import { nationalPhone } from '@/ordering/checkout/validation';
import { staffLabels, staffStatus, type StaffStatus } from '@/ordering/status';
import type { OrderSummary } from '@/ordering/contracts';
import { OrderDetail } from './OrderDetail';
import type { Role } from '@/cms/permissions';
import type { MenuData } from '@/cms/schema';
import { createOrderPoller } from './order-poller';

type List = { rows: OrderSummary[]; more: boolean; newCount: number; unprintedCount?: number };
export function Orders({ active, onUnread, role, menu }: { active: boolean; onUnread: (n: number) => void; role: Role; menu: MenuData }) {
  const router = useRouter();
  const text = (en: string, _ar?: string) => en;
  const singleBranch = role === 'branch_staff';
  const [branch, setBranch] = useState(''); const [status, setStatus] = useState('');
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [q, setQ] = useState(''); const [search, setSearch] = useState('');
  const [page, setPage] = useState(1); const [data, setData] = useState<List | null>(null);
  const [detail, setDetail] = useState<string | null>(null); const [error, setError] = useState('');
  const [sound, setSound] = useState(false); const [revision, setRevision] = useState(0);
  const [paused, setPaused] = useState(false); const [lastOk, setLastOk] = useState<string | null>(null);
  const latest = useRef<string | null>(null); const unread = useRef(0); const audio = useRef<HTMLAudioElement | null>(null);
  const activeRef = useRef(active); const soundRef = useRef(sound);
  useEffect(() => { activeRef.current = active; if (active) { unread.current = 0; onUnread(0); } }, [active, onUnread]);
  useEffect(() => { soundRef.current = sound; }, [sound]);
  useEffect(() => { audio.current = new Audio('/order-chime.wav');
    const timer = window.setTimeout(() => {
      try { setSound(localStorage.getItem('sushinaa-order-sound') === 'true'); } catch { /* Optional preference. */ }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    let live = true;
    let initial = true;
    const poller = createOrderPoller({
      hidden: () => document.hidden,
      onUnauthorized: () => { router.push('/admin/login'); },
      poll: async () => {
        try {
          const response = await fetch(`/api/admin/orders?${latest.current ? `since=${latest.current}` : 'limit=100'}`, { cache: 'no-store' });
          if (response.status === 401) return 'unauthorized';
          const body: List & { code?: string } = await response.json();
          if (!response.ok) {
            if (live) setPaused(true);
            return 'fail';
          }
          if (!live) return 'ok';
          setPaused(false);
          setLastOk(new Date().toISOString());
          if (body.rows.length) {
            const count = initial ? 0 : latest.current ? body.newCount : body.rows.length;
            latest.current = body.rows[0].id;
            if (count && !activeRef.current) { unread.current += count; onUnread(unread.current); }
            if (count && soundRef.current) void audio.current?.play().catch(() => {});
          }
          if (!initial && activeRef.current) setRevision((value) => value + 1);
          initial = false;
          return 'ok';
        } catch {
          if (live) setPaused(true);
          return 'fail';
        }
      },
    });
    void poller.start();
    const visible = () => { if (!document.hidden) void poller.wake(); };
    document.addEventListener('visibilitychange', visible);
    return () => { live = false; poller.stop(); document.removeEventListener('visibilitychange', visible); };
  }, [onUnread, router]);
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
  return <section className="staff-orders" dir="ltr">
    <div className="staff-tools"><button aria-pressed={sound} onClick={() => {
      const next = !sound; setSound(next); try { localStorage.setItem('sushinaa-order-sound', String(next)); } catch { /* Optional preference. */ }
      if (next) void audio.current?.play().catch(() => {});
    }}>{sound ? text('Sound on', 'الصوت مفعّل') : text('Enable sound', 'تفعيل الصوت')}</button>
      {typeof data?.unprintedCount === 'number' && <span className="staff-unprinted-count">{text('Not printed', 'لم تُطبع')} {data.unprintedCount}</span>}
    </div>
    {/* TODO(ar): confirm the paused-updates sentence with the restaurant. */}
    {paused && <p className="staff-poll-paused" role="status">{text('Updates paused, retrying', 'التحديثات متوقفة، جارٍ إعادة المحاولة')}{lastOk ? ` · ${new Date(lastOk).toLocaleTimeString('en', { timeZone: 'Asia/Qatar', hour: '2-digit', minute: '2-digit' })}` : ''}</p>}
    {detail ? <OrderDetail key={detail} id={detail} role={role} menu={menu} onBack={() => setDetail(null)} onChange={refresh} /> : <>
      <form className="staff-filters" onSubmit={e => { e.preventDefault(); setSearch(q.trim()); setPage(1); }}>
        {!singleBranch && <label>{text('Branch', 'الفرع')}<select aria-label={text('Order branch', 'فرع الطلب')} value={branch} onChange={e => { setBranch(e.target.value); setPage(1); }}><option value="">All branches</option>{BRANCHES.map(b => <option key={b.slug} value={b.slug}>{b.name}</option>)}</select></label>}
        <label>{text('Status', 'الحالة')}<select aria-label={text('Order status', 'حالة الطلب')} value={status} onChange={e => {setStatus(e.target.value);setPage(1);}}><option value="">{text('All statuses', 'كل الحالات')}</option>{(Object.keys(staffLabels) as StaffStatus[]).map(s => <option key={s} value={s}>{staffLabels[s].en}</option>)}</select></label>
        <label>{text('From', 'من')}<input type="date" aria-label={text('From', 'من')} value={from} onChange={e => {setFrom(e.target.value);setPage(1);}} /></label>
        <label>{text('To', 'إلى')}<input type="date" aria-label={text('To', 'إلى')} value={to} onChange={e => {setTo(e.target.value);setPage(1);}} /></label>
        <label className="staff-filter-search">{text('Order number or last 4', 'رقم الطلب أو آخر ٤')}<input value={q} maxLength={39} placeholder={text('Order number or last 4 phone digits', 'رقم الطلب أو آخر ٤ أرقام')} onChange={e => setQ(e.target.value)} /></label>
        <button type="submit">{text('Search', 'بحث')}</button>
      </form>
      {error && <div role="alert" className="staff-error">{error === 'INVALID' ? text('Check the date range, or search by an order number or the last 4 phone digits.', 'تحقق من نطاق التاريخ، أو ابحث برقم الطلب أو آخر ٤ أرقام من الجوال.') : error === 'PRINT_IN_PROGRESS' ? text('This ticket is already being printed.', 'هذه التذكرة قيد الطباعة.') : error === 'PRINT_FAILED' ? text('Unable to print this ticket. Please retry.', 'تعذّرت طباعة التذكرة. يرجى المحاولة مجدداً.') : error === 'UPDATE_FAILED' ? text('Unable to accept this order. Please retry.', 'تعذّر قبول الطلب. يرجى المحاولة مجدداً.') : text('Unable to load orders. Please retry.', 'تعذّر تحميل الطلبات. يرجى المحاولة مجدداً.')} <button onClick={refresh}>{text('Retry', 'إعادة المحاولة')}</button></div>}
      {!error && data?.rows.length === 0 && <p className="admin-empty">{text('No orders here yet.', 'لا توجد طلبات هنا بعد.')}</p>}
      {data && data.rows.length > 0 && <div className="staff-order-list" aria-live="polite"><table>
        <thead><tr>
          <th>{text('Order', 'الطلب')}</th>
          {!singleBranch && <th>{text('Branch', 'الفرع')}</th>}
          <th>{text('Phone', 'الجوال')}</th>
          <th>{text('Plate', 'اللوحة')}</th>
          <th>{text('Status', 'الحالة')}</th>
          <th>{text('Payment', 'الدفع')}</th>
          <th>{text('Time', 'الوقت')}</th>
          <th>{text('Total', 'الإجمالي')}</th>
        </tr></thead>
        <tbody>{data.rows.map(row => { const b = BRANCHES.find(item => item.slug === row.branchId); return <tr key={row.id} data-order-id={row.id} onClick={() => setDetail(row.id)}>
          <td dir="ltr">{row.orderNumber ?? '—'}</td>
          {!singleBranch && <td>{b?.name}</td>}
          <td dir="ltr">{nationalPhone(row.phone) || '—'}</td>
          <td dir="ltr">{row.plate}</td>
          <td><span className={`staff-status status-${staffStatus(row.status)}`}>{staffLabels[staffStatus(row.status)].en}</span></td>
          <td>{row.paymentMethod === 'mock' ? text('Paid (mock)', 'مدفوع (تجريبي)') : row.paidAt ? text('Paid at pickup', 'تم الدفع عند الاستلام') : text('Pay at pickup', 'الدفع عند الاستلام')}</td>
          <td><time>{new Date(row.createdAt).toLocaleTimeString('en', { timeZone: 'Asia/Qatar', hour: '2-digit', minute: '2-digit' })}</time></td>
          <td dir="ltr">{(row.totalMinor / 100).toFixed(2)} {text('QAR', 'ر.ق')}</td>
        </tr>; })}</tbody>
      </table></div>}
      {data && (page > 1 || data.more) && <nav className="admin-pager"><button disabled={page === 1} onClick={() => setPage(page - 1)}>{text('Previous', 'السابق')}</button><span>{page}</span><button disabled={!data.more} onClick={() => setPage(page + 1)}>{text('Next', 'التالي')}</button></nav>}
    </>}
  </section>;
}
