'use client';
import Link from 'next/link';
import { useLocale } from '@/i18n/locale';
export function CollectionNotice({ title }: { title: string }) {
  const { lang } = useLocale();
  return <p className="collection-privacy">{lang === 'ar'
    ? 'نستخدم اسمك ورقم جوالك وبيانات سيارتك فقط لتجهيز هذا الطلب وتسليمه إليك عند السيارة. لا يمكن الاطلاع عليها إلا للموظفين الذين سجّلوا الدخول. تُحذف هذه البيانات بعد ٩٠ يوماً من الاستلام أو الإلغاء.'
    : 'Your name, phone and vehicle details are used only to prepare this order and bring it to your car. Only signed-in staff can access them. We remove these details 90 days after collection or cancellation.'}{' '}<Link href="/privacy#collection" target="_blank">{title} ↗</Link></p>;
}
