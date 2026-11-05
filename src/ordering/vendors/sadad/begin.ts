import type { CheckoutIntent, CheckoutLaunch } from '@/ordering/payment-gateway/types';
import type { SadadConfig } from './config';
import { sadadSignature } from './signature';

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

/** Format txnDate as YYYY-MM-DD HH:mm:ss in local wall time of the Date. */
export function formatTxnDate(at: Date) {
  return `${at.getFullYear()}-${pad2(at.getMonth() + 1)}-${pad2(at.getDate())} ${pad2(at.getHours())}:${pad2(at.getMinutes())}:${pad2(at.getSeconds())}`;
}

export function formatMajorAmount(minor: number) {
  return (minor / 100).toFixed(2);
}

/** Build the auto-submit HTML form fields for Sadad WebCheckout 2.1. */
export function buildSadadLaunch(intent: CheckoutIntent, config: SadadConfig): CheckoutLaunch {
  const fields: Record<string, string> = {
    CALLBACK_URL: config.callbackUrl,
    MOBILE_NO: intent.mobileDigits.replace(/\D/g, ''),
    ORDER_ID: intent.orderId,
    SADAD_WEBCHECKOUT_PAGE_LANGUAGE: intent.language === 'ar' ? 'arb' : 'eng',
    TXN_AMOUNT: formatMajorAmount(intent.amountMinor),
    VERSION: '1.1',
    WEBSITE: config.website,
    merchant_id: config.merchantId,
    txnDate: formatTxnDate(intent.txnAt),
  };

  const signature = sadadSignature(config.secretKey, fields);
  return {
    action: 'https://sadadqa.com/webpurchase',
    method: 'POST',
    fields: {
      ...fields,
      signature,
      'productdetail[0][order_id]': intent.line.reference,
      'productdetail[0][amount]': formatMajorAmount(intent.line.amountMinor),
      'productdetail[0][quantity]': String(intent.line.quantity),
    },
  };
}
