'use client';
import { useEffect, useRef } from 'react';

type Launch = { action: string; method: 'POST'; fields: Record<string, string> };

/** Auto-submits the opaque hosted-payment form. No card fields — zero PCI surface. */
export function HostedCheckoutRedirect({
  launch,
  lang,
  onBack,
  onError,
}: {
  launch: Launch;
  lang: 'en' | 'ar';
  onBack: () => void;
  onError: (message: string) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const submitted = useRef(false);
  useEffect(() => {
    if (submitted.current) return;
    submitted.current = true;
    try {
      formRef.current?.submit();
    } catch {
      onError(lang === 'ar' ? 'تعذّر فتح صفحة الدفع.' : 'Could not open the payment page.');
    }
  }, [lang, onError]);
  const text = (en: string, ar: string) => (lang === 'ar' ? ar : en);
  return (
    <div className="ordering-page" data-step="payment" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <main id="main" className="checkout-main checkout-step">
        <h1>{text('Redirecting to payment', 'جارٍ التحويل إلى الدفع')}</h1>
        <p className="checkout-branch">{text('Pickup order — pay securely to confirm.', 'طلب استلام — ادفع بأمان للتأكيد.')}</p>
        <form ref={formRef} action={launch.action} method={launch.method} acceptCharset="UTF-8">
          {Object.entries(launch.fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
        </form>
        <button type="button" className="text-action" onClick={onBack}>
          <span className="back-arrow" aria-hidden="true">←</span> {text('Back', 'رجوع')}
        </button>
      </main>
    </div>
  );
}
