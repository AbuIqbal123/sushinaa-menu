'use client';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { Coupon, CouponKind, CouponStatus } from '@/ordering/coupons/types';
import { couponOrderOpen, type CouponOrderOpen } from '@/ordering/coupons/linked-order';
import { formatMinor } from '@/lib/money';
import { formatQatarDateTime } from '@/lib/datetime';
import { formatOrderNumber } from '@/ordering/order-number';
import { useLocale } from '@/i18n/locale';
import { useModal } from './Fields';
import { useNotify } from './Notices';
import { StatusBadge } from './StatusBadge';

const STATUSES: Record<CouponStatus, [string, string]> = {
  available: ['Available', 'متاح'],
  held: ['Held', 'محجوز'],
  redeemed: ['Redeemed', 'مستخدم'],
  disabled: ['Disabled', 'متوقف'],
};

type ExpiryParts = { date: string; time: string };

function shownCode(code: string) {
  return /^[A-Z0-9]{8}$/.test(code) ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function partsFromDate(at: Date): ExpiryParts {
  return {
    date: `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`,
    time: `${pad(at.getHours())}:${pad(at.getMinutes())}`,
  };
}

function endOfDay(daysFromNow: number) {
  const at = new Date();
  at.setDate(at.getDate() + daysFromNow);
  at.setHours(23, 59, 0, 0);
  return partsFromDate(at);
}

function isoFromParts(parts: ExpiryParts) {
  if (!parts.date || !parts.time) return '';
  const parsed = new Date(`${parts.date}T${parts.time}`);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

const PRESETS: { days: number; en: string; ar: string }[] = [
  { days: 0, en: 'Tonight', ar: 'الليلة' },
  { days: 1, en: 'Tomorrow', ar: 'غداً' },
  { days: 7, en: '7 days', ar: '7 أيام' },
  { days: 30, en: '30 days', ar: '30 يوماً' },
];

async function failureCode(response: Response) {
  const body = await response.json().catch(() => ({})) as { code?: string };
  return body.code || 'save';
}

function couponErrorMessage(error: string, text: (en: string, ar: string) => string) {
  if (error === 'CONFLICT') return text('That code is already in use.', 'هذا الرمز مستخدم بالفعل.');
  if (error === 'INVALID_CODE') return text('Use 4 to 16 letters or digits.', 'استخدم 4 إلى 16 حرفاً أو رقماً.');
  if (error === 'INVALID_VALUE') return text('Check the discount value.', 'تحقق من قيمة الخصم.');
  if (error === 'EXPIRES_REQUIRED') return text('Choose an expiry.', 'اختر تاريخ الانتهاء.');
  if (error === 'load') return text('Could not load coupons.', 'تعذّر تحميل القسائم.');
  return text('Could not save the coupon.', 'تعذّر حفظ القسيمة.');
}

export function CouponsPanel({
  creating,
  onCreating,
  onOpenLinked,
}: {
  creating: boolean;
  onCreating: (open: boolean) => void;
  onOpenLinked: (target: CouponOrderOpen) => void;
}) {
  const { lang } = useLocale();
  const text = (en: string, ar: string) => (lang === 'ar' ? ar : en);
  const notify = useNotify();
  const [rows, setRows] = useState<Coupon[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

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

  function linkedOpen(row: Coupon): CouponOrderOpen | null {
    const orderId = row.redeemedOrderId || row.heldOrderId;
    if (!orderId || !row.orderStatus || !row.orderPaymentMethod) return null;
    return couponOrderOpen({
      orderId,
      status: row.orderStatus,
      paymentMethod: row.orderPaymentMethod,
      paidAt: row.orderPaidAt,
    });
  }

  function linkedOrderCell(row: Coupon) {
    if (row.status !== 'held' && row.status !== 'redeemed') return '—';
    const kitchen = row.orderNumber != null ? `#${formatOrderNumber(row.orderNumber)}` : null;
    const txn = row.paymentReference;
    if (!kitchen && !txn) return '—';
    return (
      <>
        <span>{kitchen ?? '—'}</span>
        {txn ? <small dir="ltr">{text('Sadad', 'سداد')} {txn}</small> : null}
      </>
    );
  }

  async function postCoupon(id: string, body: Record<string, string>, ok: string) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/coupons/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) { setError(await failureCode(response)); return; }
      notify({ tone: 'ok', text: ok });
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
    await postCoupon(id, {}, text('Coupon disabled', 'تم إيقاف القسيمة'));
  }

  async function release(id: string) {
    if (busy) return;
    if (!window.confirm(text('Release this code and cancel its unpaid order?', 'تحرير هذا الرمز وإلغاء طلبه غير المدفوع؟'))) return;
    await postCoupon(id, { action: 'release' }, text('Coupon released', 'تم تحرير القسيمة'));
  }

  const offer = (row: Coupon) => row.kind === 'percent' ? `${row.value}%` : formatMinor(row.value, lang);

  return (
    <>
      {error && !creating && <p role="alert" className="staff-error">{couponErrorMessage(error, text)}</p>}
      <section className="users-list" aria-label={text('Coupons', 'القسائم')}>
        <table>
          <thead>
            <tr>
              <th>{text('Code', 'الرمز')}</th>
              <th>{text('Discount', 'الخصم')}</th>
              <th>{text('Status', 'الحالة')}</th>
              <th>{text('Expires', 'الانتهاء')}</th>
              <th>{text('Order', 'الطلب')}</th>
              <th>{text('Action', 'إجراء')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6}>{text('No coupons yet.', 'لا توجد قسائم بعد.')}</td></tr>
            )}
            {rows.map((row) => {
              const open = linkedOpen(row);
              return (
              <tr key={row.id} data-disabled={row.status === 'disabled' || undefined}>
                <td dir="ltr">{shownCode(row.code)}</td>
                <td dir="ltr">{offer(row)}</td>
                <td>
                  <StatusBadge status={row.status}>
                    {text(STATUSES[row.status][0], STATUSES[row.status][1])}
                  </StatusBadge>
                </td>
                <td dir="ltr">{formatQatarDateTime(row.expiresAt)}</td>
                <td className="staff-customer" dir="ltr">{linkedOrderCell(row)}</td>
                <td className="users-access">
                  {row.status === 'available' && (
                    <button type="button" className="danger" disabled={busy} onClick={() => void disable(row.id)}>
                      {text('Disable', 'إيقاف')}
                    </button>
                  )}
                  {row.status === 'held' && (
                    <button type="button" disabled={busy} onClick={() => void release(row.id)}>
                      {text('Release', 'تحرير')}
                    </button>
                  )}
                  {open?.section === 'orders' && (
                    <button type="button" disabled={busy} onClick={() => onOpenLinked(open)}>
                      {text('Open order', 'فتح الطلب')}
                    </button>
                  )}
                  {open?.section === 'payments' && (
                    <button type="button" disabled={busy} onClick={() => onOpenLinked(open)}>
                      {text('Open payment', 'فتح الدفع')}
                    </button>
                  )}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      {creating && (
        <CreateCouponDialog
          text={text}
          onClose={() => onCreating(false)}
          onCreated={async () => {
            onCreating(false);
            notify({ tone: 'ok', text: text('Coupon created', 'تم إنشاء القسيمة') });
            await load();
          }}
        />
      )}
    </>
  );
}

function CreateCouponDialog({
  text,
  onClose,
  onCreated,
}: {
  text: (en: string, ar: string) => string;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [code, setCode] = useState('');
  const [kind, setKind] = useState<CouponKind>('percent');
  const [value, setValue] = useState('');
  const [expires, setExpires] = useState<ExpiryParts>(() => endOfDay(7));
  const expiresIso = isoFromParts(expires);

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
    const expiresAt = isoFromParts(expires);
    if (!expiresAt) { setError('EXPIRES_REQUIRED'); return; }
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, kind, value, expiresAt }),
      });
      if (!response.ok) { setError(await failureCode(response)); return; }
      await onCreated();
    } catch {
      setError('save');
    } finally {
      setBusy(false);
    }
  }

  return (
    <CouponDialog
      title={text('Create coupon', 'إنشاء قسيمة')}
      busy={busy}
      error={error ? couponErrorMessage(error, text) : ''}
      closeLabel={text('Close', 'إغلاق')}
      submitLabel={text('Create coupon', 'إنشاء القسيمة')}
      onClose={onClose}
      onSubmit={(event) => void create(event)}
    >
      <label className="coupons-code">{text('Code', 'الرمز')}
        <span className="coupons-code-row">
          <input value={code} onChange={(event) => setCode(event.target.value)} autoComplete="off" spellCheck={false} maxLength={32} required />
          <button type="button" disabled={busy} onClick={() => void generate()}>{text('Generate', 'توليد')}</button>
        </span>
      </label>
      <div className="coupons-offer-row">
        <label>{text('Kind', 'النوع')}
          <select value={kind} onChange={(event) => { setKind(event.target.value as CouponKind); setValue(''); }}>
            <option value="percent">{text('Percent', 'نسبة')}</option>
            <option value="amount">{text('Amount', 'مبلغ')}</option>
          </select>
        </label>
        <label>{kind === 'percent' ? text('Percent', 'النسبة') : text('Amount (QAR)', 'المبلغ (ر.ق)')}
          <input value={value} onChange={(event) => setValue(event.target.value)} inputMode={kind === 'percent' ? 'numeric' : 'decimal'} autoComplete="off" required />
        </label>
      </div>
      <fieldset className="coupons-expires">
        <legend>{text('Expires', 'الانتهاء')}</legend>
        <div className="coupons-expiry-presets" role="group" aria-label={text('Quick expiry', 'انتهاء سريع')}>
          {PRESETS.map((preset) => (
            <button
              key={preset.days}
              type="button"
              className="coupons-expiry-preset"
              disabled={busy}
              onClick={() => setExpires(endOfDay(preset.days))}
            >
              {text(preset.en, preset.ar)}
            </button>
          ))}
        </div>
        <div className="coupons-expiry-fields">
          <label>{text('Date', 'التاريخ')}
            <input type="date" value={expires.date} min={partsFromDate(new Date()).date} onChange={(event) => setExpires((current) => ({ ...current, date: event.target.value }))} required />
          </label>
          <label>{text('Time', 'الوقت')}
            <input type="time" value={expires.time} onChange={(event) => setExpires((current) => ({ ...current, time: event.target.value }))} required />
          </label>
        </div>
        {expiresIso && (
          <p className="coupons-expiry-preview" dir="ltr">
            {text('Ends', 'ينتهي')} {formatQatarDateTime(expiresIso)}
          </p>
        )}
      </fieldset>
    </CouponDialog>
  );
}

function CouponDialog({
  title,
  busy,
  error,
  closeLabel,
  submitLabel,
  onClose,
  onSubmit,
  children,
}: {
  title: string;
  busy: boolean;
  error: string;
  closeLabel: string;
  submitLabel: string;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useModal(ref);
  return (
    <dialog
      ref={ref}
      className="users-dialog coupons-dialog"
      aria-labelledby="coupon-dialog-title"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClose={onClose}
    >
      <form onSubmit={onSubmit}>
        <header className="admin-dialog-head">
          <h2 id="coupon-dialog-title">{title}</h2>
          <button type="button" disabled={busy} onClick={onClose}>{closeLabel}</button>
        </header>
        <div className="admin-dialog-body">
          {error && <p role="alert" className="staff-error">{error}</p>}
          {children}
        </div>
        <footer className="admin-dialog-foot">
          <button className="primary" type="submit" disabled={busy}>{submitLabel}</button>
        </footer>
      </form>
    </dialog>
  );
}
