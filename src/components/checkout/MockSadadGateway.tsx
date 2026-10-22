'use client';

import { useEffect, useState } from 'react';

type Method = 'card' | 'debit' | 'sadad';
type Phase = 'choose' | 'processing' | 'confirmed';

export function MockSadadGateway({ amount, lang, onBack, receipt }: {
  amount: string;
  lang: 'en' | 'ar';
  onBack: () => void;
  receipt: React.ReactNode;
}) {
  const [method, setMethod] = useState<Method>('card');
  const [phase, setPhase] = useState<Phase>('choose');
  const t = (en: string, ar: string) => lang === 'ar' ? ar : en;

  useEffect(() => {
    if (phase !== 'processing') return;
    const timer = window.setTimeout(() => setPhase('confirmed'), 1700);
    return () => window.clearTimeout(timer);
  }, [phase]);

  return <div className="sadad-demo" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
    {phase !== 'confirmed' ? <>
      <div className="sadad-demo-top"><button type="button" onClick={onBack} disabled={phase === 'processing'} aria-label={t('Back to order', 'العودة إلى الطلب')}>←</button><span className="sadad-wordmark">SADAD<span className="sadad-mark">●</span></span><span className="sadad-demo-badge">{t('DEMO', 'تجريبي')}</span></div>
      <div className="sadad-demo-body">
        <div className="sadad-merchant"><span className="sadad-merchant-monogram">S</span><div><strong>Sushinaa</strong><span>{t('Car collection', 'استلام عند السيارة')}</span></div></div>
        <div className="sadad-amount"><span>{t('Amount to pay', 'المبلغ المستحق')}</span><strong dir="ltr">{amount}</strong></div>
        <h2>{t('Select a payment method', 'اختر طريقة الدفع')}</h2>
        <div className="sadad-methods" role="radiogroup" aria-label={t('Payment method', 'طريقة الدفع')}>
          {([['card', t('Credit card', 'بطاقة ائتمانية'), 'VISA  Mastercard'], ['debit', t('Debit card', 'بطاقة خصم'), 'NAPS  HIMYAN'], ['sadad', t('SADAD Pay', 'سداد باي'), 'SADAD']] as const).map(([id, label, brand]) => <button key={id} type="button" role="radio" aria-checked={method === id} disabled={phase === 'processing'} className={method === id ? 'selected' : ''} onClick={() => setMethod(id)}><span className="sadad-radio" /><span>{label}</span><small>{brand}</small></button>)}
        </div>
        <div className="sadad-demo-fields" aria-hidden="true"><span>{method === 'sadad' ? t('SADAD account', 'حساب سداد') : t('Card details', 'بيانات البطاقة')}</span><div>•••• &nbsp; •••• &nbsp; •••• &nbsp; 4242</div><div className="sadad-demo-field-row"><div>MM / YY</div><div>CVV</div></div></div>
        <button type="button" className="sadad-pay" disabled={phase === 'processing'} onClick={() => setPhase('processing')}>{phase === 'processing' ? <><span className="sadad-spinner" />{t('Confirming demo payment…', 'تأكيد الدفع التجريبي…')}</> : t(`Simulate payment · ${amount}`, `محاكاة الدفع · ${amount}`)}</button>
        <p className="sadad-demo-disclaimer">{t('Demo only. No card details are entered, no money is charged, and no order is sent.', 'عرض تجريبي فقط. لا تُدخل بيانات بطاقة، ولا يُخصم مبلغ، ولا يُرسل طلب.')}</p>
      </div>
      <div className="sadad-demo-bottom">{t('Payment preview inspired by SADAD checkout', 'معاينة دفع مستوحاة من صفحة سداد')}</div>
    </> : <div className="sadad-confirmation" aria-live="polite"><div className="sadad-success-ring"><svg viewBox="0 0 80 80" role="img" aria-label={t('Demo payment confirmed', 'تم تأكيد الدفع التجريبي')}><circle cx="40" cy="40" r="36" /><path d="M22 40.5 34 52l24-26" /></svg></div><span className="sadad-demo-badge">{t('DEMO CONFIRMATION', 'تأكيد تجريبي')}</span><h2>{t('Payment preview complete', 'اكتملت معاينة الدفع')}</h2><p>{t('No payment was taken and no order was placed.', 'لم يُخصم مبلغ ولم يُرسل طلب.')}</p><div className="sadad-confirmation-receipt">{receipt}</div><button type="button" className="sadad-pay" onClick={onBack}>{t('Back to order', 'العودة إلى الطلب')}</button></div>}
  </div>;
}
