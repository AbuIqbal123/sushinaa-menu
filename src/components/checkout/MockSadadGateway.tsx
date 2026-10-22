'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

type Method = 'card' | 'debit' | 'sadad' | 'gpay';
type Phase = 'choose' | 'processing' | 'confirmed';

export function MockSadadGateway({ amount, lang, onBack, onComplete }: {
  amount: string;
  lang: 'en' | 'ar';
  onBack: () => void;
  onComplete: () => void;
}) {
  const [method, setMethod] = useState<Method>('card');
  const [phase, setPhase] = useState<Phase>('choose');
  const t = (en: string, ar: string) => lang === 'ar' ? ar : en;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [phase]);
  useEffect(() => {
    if (phase !== 'processing') return;
    const timer = window.setTimeout(() => setPhase('confirmed'), 1400);
    return () => window.clearTimeout(timer);
  }, [phase]);
  useEffect(() => {
    if (phase !== 'confirmed') return;
    const timer = window.setTimeout(onComplete, 1700);
    return () => window.clearTimeout(timer);
  }, [phase, onComplete]);

  return <main className="sadad-demo" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
    <header className="sadad-demo-top"><div className="sadad-merchant"><span className="sadad-merchant-logo"><Image src="/brand/logo.svg" width={42} height={42} alt="" unoptimized /></span><strong>Sushinaa</strong></div><span className="sadad-demo-badge">{t('DEMO', 'تجريبي')}</span></header>
    {phase === 'confirmed' ? <section className="sadad-confirmation" aria-live="polite"><div className="sadad-success-ring"><svg viewBox="0 0 80 80" role="img" aria-label={t('Demo payment confirmed', 'تم تأكيد الدفع التجريبي')}><circle cx="40" cy="40" r="36" /><path d="M22 40.5 34 52l24-26" /></svg></div><h1>{t('Payment demo complete', 'اكتملت معاينة الدفع')}</h1><p>{t('Returning to your order preview', 'العودة إلى معاينة طلبك')}</p></section> : <div className="sadad-checkout-layout">
      <aside className="sadad-order-side"><button type="button" className="sadad-back" onClick={onBack} disabled={phase === 'processing'}><span aria-hidden="true">‹</span>{t('Back', 'رجوع')}</button><span className="sadad-side-label">{t('TOTAL AMOUNT', 'المبلغ الإجمالي')}</span><strong dir="ltr">{amount}</strong><small>{t('Preview only · no transaction reference', 'معاينة فقط · لا يوجد مرجع عملية')}</small></aside>
      <section className="sadad-payment-card" aria-label={t('Demo payment gateway', 'بوابة الدفع التجريبية')}>
        <h1>{t('Select a Payment Method', 'اختر طريقة الدفع')}</h1>
        <button type="button" className={`sadad-gpay${method === 'gpay' ? ' active' : ''}`} disabled={phase === 'processing'} onClick={() => setMethod('gpay')}><b>G</b> Pay</button>
        <div className="sadad-or"><span>{t('Or Pay Using', 'أو ادفع باستخدام')}</span></div>
        <div className="sadad-methods" role="radiogroup" aria-label={t('Payment method', 'طريقة الدفع')}>
          {([['card', t('Credit Card', 'بطاقة ائتمانية'), '▭'], ['debit', t('Debit Card', 'بطاقة خصم'), '▱'], ['sadad', t('Sadad Pay', 'سداد باي'), '▣']] as const).map(([id, label, icon]) => <button key={id} type="button" role="radio" aria-checked={method === id} disabled={phase === 'processing'} className={method === id ? 'selected' : ''} onClick={() => setMethod(id)}><span aria-hidden="true">{icon}</span>{label}</button>)}
        </div>
        {method === 'gpay' ? <div className="sadad-gpay-preview">{t('Google Pay preview', 'معاينة Google Pay')}</div> : method === 'sadad' ? <div className="sadad-static-fields" aria-hidden="true"><div>{t('Mobile Number', 'رقم الجوال')}</div><div>{t('SADAD account', 'حساب سداد')}</div></div> : <div className="sadad-static-fields" aria-hidden="true"><div>{t('Card Holder Name', 'اسم حامل البطاقة')}</div><div className="sadad-card-number">{t('Card Number', 'رقم البطاقة')}<span>●● &nbsp; VISA</span></div><div className="sadad-field-pair"><div>{t('Expiry', 'تاريخ الانتهاء')}</div><div>CVV</div></div></div>}
        <button type="button" className="sadad-pay" disabled={phase === 'processing'} onClick={() => setPhase('processing')}>{phase === 'processing' ? <><span className="sadad-spinner" />{t('Processing demo…', 'معالجة التجربة…')}</> : t(`Simulate Pay ${amount}`, `محاكاة دفع ${amount}`)}</button>
        <p className="sadad-demo-disclaimer">{t('Demo only. No card details, charge, or order submission.', 'عرض تجريبي فقط. لا بيانات بطاقة ولا خصم ولا إرسال طلب.')}</p>
      </section>
    </div>}
    <footer className="sadad-demo-bottom">{t('SADAD-style checkout preview · not connected to SADAD', 'معاينة مستوحاة من سداد · غير متصلة بسداد')}</footer>
  </main>;
}
