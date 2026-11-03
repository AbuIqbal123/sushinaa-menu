'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BRANCHES } from '@/branches/branches';
import { formatOrderNumber } from '@/ordering/order-number';

type PaymentRow = {
  orderId: string;
  orderNumber: number | null;
  branchId: string;
  status: string;
  amountMinor: number;
  currency: string;
  provider: string;
  reference: string | null;
  recordedAt: string;
  customerName: string;
  customerPhone: string;
};

type List = { rows: PaymentRow[]; more: boolean };
type Detail = {
  orderId: string;
  orderNumber: number | null;
  branchId: string;
  status: string;
  amountMinor: number;
  currency: string;
  provider: string;
  reference: string | null;
  recordedAt: string;
  customerName: string;
  customerPhone: string;
  history: Array<{
    kind: string;
    status: string;
    reference: string | null;
    amountMinor: number | null;
    at: string;
    provider: string;
  }>;
};

function money(minor: number) {
  return `${(minor / 100).toFixed(2)} QAR`;
}

/** Admin-only ledger of online pickup payments (Sadad / mock). No refunds. */
export function Payments({ active }: { active: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState('');
  const [branch, setBranch] = useState('');
  const [data, setData] = useState<List | null>(null);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<Detail | null>(null);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ limit: '50' });
    if (status) params.set('status', status);
    if (branch) params.set('branchId', branch);
    fetch(`/api/admin/payments?${params}`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) { router.push('/admin/login'); return; }
        const body = await response.json() as List & { code?: string };
        if (!response.ok) { setError(body.code || 'LOAD_FAILED'); return; }
        setData(body);
        setError('');
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        setError('LOAD_FAILED');
      });
    return () => controller.abort();
  }, [active, status, branch, router, revision]);

  async function openDetail(orderId: string, reveal = false) {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(
        `/api/admin/payments/${orderId}${reveal ? '?contact=1' : ''}`,
        { cache: 'no-store' },
      );
      if (response.status === 401) { router.push('/admin/login'); return; }
      const body = await response.json() as Detail & { code?: string };
      if (!response.ok) { setError(body.code || 'LOAD_FAILED'); return; }
      setDetail(body);
    } catch {
      setError('LOAD_FAILED');
    } finally {
      setBusy(false);
    }
  }

  if (!active) return null;

  return (
    <section className="staff-orders" dir="ltr" aria-busy={busy}>
      <form className="staff-filters" onSubmit={(e) => e.preventDefault()}>
        <label>
          Status
          <select aria-label="Payment status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="awaiting_payment">Awaiting payment</option>
            <option value="processing">Processing</option>
            <option value="paid">Paid</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
            <option value="expired">Expired</option>
          </select>
        </label>
        <label>
          Branch
          <select aria-label="Branch" value={branch} onChange={(e) => setBranch(e.target.value)}>
            <option value="">All branches</option>
            {BRANCHES.map((b) => (
              <option key={b.slug} value={b.slug}>{b.name}</option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => setRevision((n) => n + 1)}>Refresh</button>
      </form>

      {error && (
        <div role="alert" className="staff-error">
          Unable to load payments. <button type="button" onClick={() => setRevision((n) => n + 1)}>Retry</button>
        </div>
      )}

      {data && data.rows.length === 0 && (
        <p className="staff-empty">No online pickup payments yet.</p>
      )}

      {data && data.rows.length > 0 && (
        <div className="staff-order-list">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Order</th>
                <th>Branch</th>
                <th>Customer</th>
                <th>Amount</th>
                <th>Provider</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.orderId}>
                  <td>
                    <button type="button" className="text-action" onClick={() => void openDetail(row.orderId)}>
                      {new Date(row.recordedAt).toLocaleString('en', { timeZone: 'Asia/Qatar' })}
                    </button>
                  </td>
                  <td dir="ltr">{row.orderNumber != null ? formatOrderNumber(row.orderNumber) : '—'}</td>
                  <td>{BRANCHES.find((b) => b.slug === row.branchId)?.name ?? row.branchId}</td>
                  <td className="staff-customer">{row.customerName}<br /><span dir="ltr">{row.customerPhone}</span></td>
                  <td dir="ltr">{money(row.amountMinor)}</td>
                  <td>{row.provider}</td>
                  <td><span className={`staff-status status-${row.status}`}>{row.status.replace(/_/g, ' ')}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.more && <p className="staff-more">More rows available — narrow the filters.</p>}
        </div>
      )}

      {detail && (
        <aside className="staff-order-detail" aria-label="Payment detail">
          <header className="staff-detail-head">
            <h2>
              {detail.orderNumber != null ? formatOrderNumber(detail.orderNumber) : detail.orderId}
            </h2>
            <button type="button" className="text-action" onClick={() => setDetail(null)}>Close</button>
          </header>
          <dl>
            <div><dt>Status</dt><dd>{detail.status.replace(/_/g, ' ')}</dd></div>
            <div><dt>Amount</dt><dd dir="ltr">{money(detail.amountMinor)}</dd></div>
            <div><dt>Provider</dt><dd>{detail.provider}</dd></div>
            <div><dt>Reference</dt><dd dir="ltr">{detail.reference || '—'}</dd></div>
            <div><dt>Customer</dt><dd>{detail.customerName} · <span dir="ltr">{detail.customerPhone}</span></dd></div>
          </dl>
          {detail.customerPhone.includes('••••') && (
            <button type="button" className="text-action" onClick={() => void openDetail(detail.orderId, true)}>
              Reveal contact
            </button>
          )}
          <details className="staff-history" open>
            <summary>Payment history</summary>
            <ol>
              {detail.history.map((h, i) => (
                <li key={`${h.at}-${i}`}>
                  <time>{new Date(h.at).toLocaleString('en', { timeZone: 'Asia/Qatar' })}</time>
                  {' · '}{h.kind} · {h.status}
                  {h.reference ? ` · ${h.reference}` : ''}
                  {h.amountMinor != null ? ` · ${money(h.amountMinor)}` : ''}
                </li>
              ))}
              {detail.history.length === 0 && <li>No ledger events yet.</li>}
            </ol>
          </details>
        </aside>
      )}
    </section>
  );
}
