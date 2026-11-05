'use client';
import { useEffect, useState, type FormEvent } from 'react';
import type { Coupon, CouponKind, CouponStatus } from '@/ordering/coupons/types';
import { formatMinor } from '@/lib/money';
import { formatQatarDateTime } from '@/lib/datetime';
import { useLocale } from '@/i18n/locale';
import { useNotify } from './Notices';

const STATUSES: Record<CouponStatus, [string, string]> = {
  available: ['Available', 'متاح'],
  held: ['Held', 'محجوز'],
  redeemed: ['Redeemed', 'مستخدم'],
  disabled: ['Disabled', 'متوقف'],
};

function shownCode(code: string) {
  return /^[A-Z0-9]{8}$/.test(code) ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

function isoFromLocalInput(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

export function CouponsPanel() {
  const { lang } = useLocale();
  const text = (en: string, ar: string) => (lang === 'ar' ? ar : en);
  const notify = useNotify();
  const [rows, setRows] = useState<Coupon[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [kind, setKind] = useState<CouponKind>('percent');
  const [value, setValue] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  async function load() {
    const response = await fetch('/api/admin/coupons', { cache: 'no-store' });
    if (!response.ok) throw new Error('load');
    setRows(await response.json() as Coupon[]);
  }

  useEffect(() => {
    let live = true;
    fetch('/api/admin/coupons', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('load');
        const body = await response.json() as Coupon[];
        if (live) setRows(body);
      })
      .catch(() => { if (live) setError('load'); });
    return () => { live = false; };
  }, []);

  async function failureCode(response: Response) {
    const body = await response.json().catch(() => ({})) as { code?: string };
    return body.code || 'save';
  }

  async function generate() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generate: true }),
      });
      if (!response.ok) { setError(await failureCode(response)); return; }
      const body = await response.json() as { code?: string };
      if (!body.code) { setError('save'); return; }
      setCode(body.code);
    } catch {
      setError('save');
    } finally {
      setBusy(false);
    }
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const expires = isoFromLocalInput(expiresAt);
    if (!expires) { setError('EXPIRES_REQUIRED'); return; }
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, kind, value, expiresAt: expires }),
      });
      if (!response.ok) { setError(await failureCode(response)); return; }
      setCode('');
      setValue('');
      notify({ tone: 'ok', text: text('Coupon created', 'تم إنشاء القسيمة') });
      await load();
    } catch {
      setError('save');
    } finally {
      setBusy(false);
    }
  }

  async function disable(id: string) {
    if (busy) return;
    if (!window.confirm(text('Disable this unused code?', 'إيقاف هذا الرمز غير المستخدم؟'))) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/coupons/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!response.ok) { setError(await failureCode(response)); return; }
      notify({ tone: 'ok', text: text('Coupon disabled', 'تم إيقاف القسيمة') });
      await load();
    } catch {
      setError('save');
    } finally {
      setBusy(false);
    }
  }

  const message = error === 'CONFLICT'
    ? text('That code is already in use.', 'هذا الرمز مستخدم بالفعل.')
    : error === 'INVALID_CODE'
      ? text('Use 4 to 16 letters or digits.', 'استخدم 4 إلى 16 حرفاً أو رقماً.')
      : error === 'INVALID_VALUE'
        ? text('Check the discount value.', 'تحقق من قيمة الخصم.')
        : error === 'EXPIRES_REQUIRED'
          ? text('Choose an expiry.', 'اختر تاريخ الانتهاء.')
          : error === 'load'
            ? text('Could not load coupons.', 'تعذّر تحميل القسائم.')
            : text('Could not save the coupon.', 'تعذّر حفظ القسيمة.');
  const offer = (row: Coupon) => row.kind === 'percent' ? `${row.value}%` : formatMinor(row.value, lang);

  return (
    <section aria-label={text('Coupons', 'القسائم')}>
      <form className="coupons-form" onSubmit={(event) => void create(event)}>
        <label className="coupons-code">{text('Code', 'الرمز')}
          <span className="coupons-code-row">
            <input value={code} onChange={(event) => setCode(event.target.value)} autoComplete="off" spellCheck={false} maxLength={32} required />
            <button type="button" disabled={busy} onClick={() => void generate()}>{text('Generate', 'توليد')}</button>
          </span>
        </label>
        <label>{text('Kind', 'النوع')}
          <select value={kind} onChange={(event) => { setKind(event.target.value as CouponKind); setValue(''); }}>
            <option value="percent">{text('Percent', 'نسبة')}</option>
            <option value="amount">{text('Amount', 'مبلغ')}</option>
          </select>
        </label>
        <label>{kind === 'percent' ? text('Percent', 'النسبة') : text('Amount (QAR)', 'المبلغ (ر.ق)')}
          <input value={value} onChange={(event) => setValue(event.target.value)} inputMode={kind === 'percent' ? 'numeric' : 'decimal'} autoComplete="off" required />
        </label>
        <label>{text('Expires', 'الانتهاء')}
          <input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} required />
        </label>
        <button className="primary" type="submit" disabled={busy}>{text('Create', 'إنشاء')}</button>
      </form>
      {error && <p role="alert" className="staff-error">{message}</p>}
      <div className="users-list">
        <table>
          <thead>
            <tr>
              <th>{text('Code', 'الرمز')}</th>
              <th>{text('Discount', 'الخصم')}</th>
              <th>{text('Status', 'الحالة')}</th>
              <th>{text('Expires', 'الانتهاء')}</th>
              <th>{text('Redeemed order', 'طلب الاسترداد')}</th>
              <th>{text('Action', 'إجراء')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6}>{text('No coupons yet.', 'لا توجد قسائم بعد.')}</td></tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} data-disabled={row.status === 'disabled' || row.status === 'redeemed' || undefined}>
                <td dir="ltr">{shownCode(row.code)}</td>
                <td dir="ltr">{offer(row)}</td>
                <td>{text(STATUSES[row.status][0], STATUSES[row.status][1])}</td>
                <td dir="ltr">{formatQatarDateTime(row.expiresAt)}</td>
                <td dir="ltr">{row.redeemedOrderId ?? ''}</td>
                <td className="users-access">
                  {row.status === 'available' && (
                    <button type="button" className="danger" disabled={busy} onClick={() => void disable(row.id)}>
                      {text('Disable', 'إيقاف')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
