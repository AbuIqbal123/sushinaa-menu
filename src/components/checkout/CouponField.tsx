'use client';
import { useEffect, useRef, useState } from 'react';

export type AppliedCoupon = {
  code: string;
  discountMinor: number;
  totalMinor: number;
  subtotalMinor: number;
};

const COUPON_COPY: Record<string, readonly [string, string]> = {
  INVALID_CODE: ['Enter a valid code.', 'أدخل رمزاً صالحاً.'],
  NOT_FOUND: ['Code not found.', 'الرمز غير موجود.'],
  UNAVAILABLE: ['This code cannot be used.', 'لا يمكن استخدام هذا الرمز.'],
  EXPIRED: ['This code has expired.', 'انتهت صلاحية هذا الرمز.'],
  NON_POSITIVE: ['This code leaves nothing to pay.', 'هذا الرمز لا يترك مبلغاً للدفع.'],
  CONFLICT: ['This code is already in use.', 'هذا الرمز مستخدم حالياً.'],
  INVALID_VALUE: ['This code cannot be used.', 'لا يمكن استخدام هذا الرمز.'],
  EXPIRES_REQUIRED: ['This code cannot be used.', 'لا يمكن استخدام هذا الرمز.'],
};

export function knownCouponMessage(code: string, text: (en: string, ar: string) => string) {
  const pair = COUPON_COPY[code];
  return pair ? text(pair[0], pair[1]) : null;
}

function readQuote(data: { code?: unknown; discountMinor?: unknown; totalMinor?: unknown }, subtotalMinor: number): AppliedCoupon | null {
  const { code, discountMinor, totalMinor } = data;
  if (typeof code !== 'string' || code.length < 1 || code.length > 32) return null;
  if (typeof discountMinor !== 'number' || typeof totalMinor !== 'number') return null;
  if (!Number.isInteger(discountMinor) || !Number.isInteger(totalMinor)) return null;
  if (discountMinor <= 0 || totalMinor <= 0 || discountMinor + totalMinor !== subtotalMinor) return null;
  return { code, discountMinor, totalMinor, subtotalMinor };
}

export function CouponField({
  subtotalMinor,
  applied,
  text,
  onApplied,
  onPending,
  onRemove,
}: {
  subtotalMinor: number;
  applied: AppliedCoupon | null;
  text: (en: string, ar: string) => string;
  onApplied: (quote: AppliedCoupon) => void;
  onPending: (pending: boolean) => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || applied) return;
    inputRef.current?.focus();
  }, [open, applied]);

  function failureCopy(code: string | undefined) {
    if (code === 'SESSION_REQUIRED') return text('Refresh the page, then apply the code.', 'حدّث الصفحة ثم طبّق الرمز.');
    if (code === 'INVALID') return text('Check the code and try again.', 'تحقق من الرمز وحاول مجدداً.');
    return knownCouponMessage(code ?? '', text) ?? text('Could not apply that code.', 'تعذّر تطبيق هذا الرمز.');
  }

  async function apply(event: React.FormEvent) {
    event.preventDefault();
    const code = draft.trim();
    if (!code || busy) return;
    const quotedSubtotal = subtotalMinor;
    setBusy(true);
    onPending(true);
    setMessage('');
    try {
      const response = await fetch('/api/orders/coupon-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, subtotalMinor: quotedSubtotal }),
      });
      const data = await response.json() as { code?: unknown; discountMinor?: unknown; totalMinor?: unknown };
      const quote = readQuote(data, quotedSubtotal);
      if (!response.ok || !quote) {
        setMessage(failureCopy(typeof data.code === 'string' ? data.code : undefined));
        return;
      }
      onApplied(quote);
      setOpen(false);
    } catch {
      setMessage(text('Could not apply that code.', 'تعذّر تطبيق هذا الرمز.'));
    } finally {
      setBusy(false);
      onPending(false);
    }
  }

  if (applied) {
    return <div className="coupon-field">
      <div className="coupon-applied">
        <span dir="ltr">{applied.code}</span>
        <button type="button" className="text-action" onClick={() => { setDraft(applied.code); setMessage(''); setOpen(true); onRemove(); }}>{text('Remove', 'إزالة')}</button>
      </div>
    </div>;
  }

  if (!open) {
    return <div className="coupon-field">
      <button type="button" className="coupon-prompt text-action" onClick={() => setOpen(true)}>
        {text('Do you have a coupon?', 'هل لديك قسيمة؟')}
      </button>
    </div>;
  }

  return <form className="coupon-field" onSubmit={apply}>
    <label htmlFor="coupon-code">{text('Coupon code', 'رمز القسيمة')}</label>
    <div className="coupon-entry" dir="ltr">
      <input ref={inputRef} id="coupon-code" value={draft} maxLength={32} autoComplete="off" autoCapitalize="characters" spellCheck={false} disabled={busy} aria-invalid={Boolean(message)} aria-describedby={message ? 'coupon-error' : undefined} onChange={event => { setDraft(event.target.value); setMessage(''); }} />
      <button type="submit" disabled={busy || !draft.trim()}>{busy ? text('Checking…', 'جارٍ التحقق…') : text('Apply', 'تطبيق')}</button>
    </div>
    {message && <small id="coupon-error" className="field-error" role="alert">{message}</small>}
  </form>;
}
