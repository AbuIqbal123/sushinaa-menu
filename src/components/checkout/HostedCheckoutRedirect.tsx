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
  const text = (en: string, ar: string) => (lang === 'ar' ? ar : en);

  useEffect(() => {
    let cancelled = false;
    // Defer past React Strict Mode's mount→cleanup→remount so submit runs on the live form.
    const id = window.setTimeout(() => {
      if (cancelled) return;
      const form = formRef.current;
      if (!form) {
        onError(lang === 'ar' ? 'تعذّر فتح صفحة الدفع.' : 'Could not open the payment page.');
        return;
      }
      try {
        form.submit();
      } catch {
        onError(lang === 'ar' ? 'تعذّر فتح صفحة الدفع.' : 'Could not open the payment page.');
      }
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [lang, onError, launch.action]);

  return (
    <div className="ordering-page" data-step="payment" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <main id="main" className="checkout-main checkout-step">
        <h1>{text('Redirecting to payment', 'جارٍ التحويل إلى الدفع')}</h1>
        <p className="checkout-branch">{text('Pickup order — pay securely to confirm.', 'طلب استلام — ادفع بأمان للتأكيد.')}</p>
        <form ref={formRef} action={launch.action} method={launch.method} acceptCharset="UTF-8">
          {Object.entries(launch.fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} defaultValue={value} />
          ))}
          <noscript>
            <button type="submit" className="checkout-primary">{text('Continue to payment', 'المتابعة إلى الدفع')}</button>
          </noscript>
        </form>
        <div className="checkout-step-action">
          <button
            type="button"
            className="checkout-primary"
            onClick={() => {
              try {
                formRef.current?.submit();
              } catch {
                onError(lang === 'ar' ? 'تعذّر فتح صفحة الدفع.' : 'Could not open the payment page.');
              }
            }}
          >
            {text('Continue to payment', 'المتابعة إلى الدفع')}
          </button>
        </div>
        <button type="button" className="text-action" onClick={onBack}>
          <span className="back-arrow" aria-hidden="true">←</span> {text('Back', 'رجوع')}
        </button>
      </main>
    </div>
  );
}
