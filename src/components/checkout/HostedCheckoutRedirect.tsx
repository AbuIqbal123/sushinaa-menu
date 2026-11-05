'use client';
import { useEffect, useEffectEvent, useRef } from 'react';

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
  const submittedFor = useRef<string | null>(null);
  const text = (en: string, ar: string) => (lang === 'ar' ? ar : en);
  const fail = useEffectEvent((message: string) => onError(message));

  useEffect(() => {
    const launchKey = `${launch.action}:${launch.fields.ORDER_ID ?? ''}:${launch.fields.signature ?? ''}`;
    if (submittedFor.current === launchKey) return;

    let cancelled = false;
    // Defer past React Strict Mode's mount→cleanup→remount so submit runs on the live form.
    const id = window.setTimeout(() => {
      if (cancelled) return;
      const form = formRef.current;
      if (!form) {
        fail(lang === 'ar' ? 'تعذّر فتح صفحة الدفع.' : 'Could not open the payment page.');
        return;
      }
      submittedFor.current = launchKey;
      try {
        form.submit();
      } catch {
        submittedFor.current = null;
        fail(lang === 'ar' ? 'تعذّر فتح صفحة الدفع.' : 'Could not open the payment page.');
      }
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [lang, launch.action, launch.fields.ORDER_ID, launch.fields.signature]);

  return (
    <div className="ordering-page" data-step="payment" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <main id="main" className="checkout-main has-step-action">
        <div className="checkout-payment-copy">
          <h1>{text('Redirecting to payment', 'جارٍ التحويل إلى الدفع')}</h1>
          <p className="checkout-branch">{text('Pickup order — pay securely to confirm.', 'طلب استلام — ادفع بأمان للتأكيد.')}</p>
          <form ref={formRef} id="sadad-hosted-checkout" action={launch.action} method={launch.method} acceptCharset="UTF-8">
            {Object.entries(launch.fields).map(([name, value]) => (
              <input key={name} type="hidden" name={name} defaultValue={value} />
            ))}
            <noscript>
              <button type="submit" className="checkout-primary">{text('Continue to payment', 'المتابعة إلى الدفع')}</button>
            </noscript>
          </form>
          <button type="button" className="text-action" onClick={onBack}>
            <span className="back-arrow" aria-hidden="true">←</span> {text('Back', 'رجوع')}
          </button>
        </div>
        <div className="checkout-step-action">
          <button type="submit" form="sadad-hosted-checkout" className="checkout-primary">
            {text('Continue to payment', 'المتابعة إلى الدفع')}
          </button>
        </div>
      </main>
    </div>
  );
}
