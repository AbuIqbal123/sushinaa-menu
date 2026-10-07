"use client";
import { useMenu } from "@/cms/context";

import Link from "next/link";
import { ContactForm } from "./ContactForm";
import { LegalShell } from "./LegalShell";
import { useLocale } from "@/i18n/locale";


export function PrivacyView() {
 const {settings:SITE}=useMenu();
  const { lang, t } = useLocale();
  const wa = `https://wa.me/${SITE.whatsappE164}`;
  if (lang === "ar") {
    return (
      <LegalShell title={t.privacyTitle}>
        <p>{t.updated}</p>
        <p>
          سوشينا مطبخ سوشي في قطر. هذه القائمة تتيح لك تجهيز طلب وإرساله إلينا على واتساب. لا يتم
          الدفع على هذا الموقع.
        </p>
        <h2>من نحن</h2>
        <p>
          التواصل: واتساب <a href={wa}>{SITE.whatsappDisplay}</a>. إنستغرام{" "}
          <a href={SITE.instagram}>{SITE.instagramHandle}</a>. مناطق التوصيل: داون تاون، أسباير،
          الخور، سيلين، ونعيجة.
        </p>
        <h2>ماذا يُحفظ على جهازك</h2>
        <p>
          طلبك (أسماء الأطباق والخيارات والكميات وأي ملاحظة) يُحفظ في المتصفح حتى لا يفرغ عند
          تحديث الصفحة. يبقى على هاتفك إلى أن تمسح الطلب أو بيانات الموقع. هذا ضروري لعمل القائمة.
        </p>
        <h2>التحليلات</h2>
        <p>نستخدم تحليلات فيرسل لعدد الزيارات والأداء بشكل مجهول. لا تُعرّفك بالاسم.</p>
        <h2>واتساب</h2>
        <p>
          إرسال الطلب يفتح واتساب برسالة جاهزة. واتساب منتج من ميتا. بعد الإرسال تصبح المحادثة بينك
          وبين سوشينا وفق شروط واتساب.
        </p>
        <h2>نموذج التواصل</h2>
        <p>صفحة التواصل تفتح واتساب باسمك ورقمك ورسالتك فقط. لا نشغّل بريداً خاصاً على هذا الموقع.</p>
        <h2>خياراتك</h2>
        <p>امسح الطلب من القائمة، أو امسح بيانات الموقع من المتصفح، أو راسلنا على واتساب عن طلب أرسلته.</p>
      </LegalShell>
    );
  }
  return (
    <LegalShell title={t.privacyTitle}>
      <p>{t.updated}</p>
      <p>
        {SITE.name} is a sushi kitchen in Qatar. This QR menu lets you build a
        ticket and send it to us on WhatsApp. We do not take payment on this website.
      </p>
      <h2>Who we are</h2>
      <p>
        Contact: WhatsApp <a href={wa}>{SITE.whatsappDisplay}</a>. Instagram{" "}
        <a href={SITE.instagram}>{SITE.instagramHandle}</a>. Delivery areas include{" "}
        {SITE.areas.join(", ")}.
      </p>
      <h2>What we store on your device</h2>
      <p>
        Your ticket (dish names, options, quantities, and any comment) is saved in the browser with{" "}
        <code>localStorage</code> so a refresh does not empty the order. That storage stays on your
        phone unless you clear the ticket or site data. It is necessary for the menu to work.
      </p>
      <h2>Analytics</h2>
      <p>We use Vercel Analytics for anonymous page views and performance. It does not identify you by name.</p>
      <h2>WhatsApp</h2>
      <p>
        Sending a ticket opens WhatsApp with a pre-filled message. WhatsApp is Meta’s product. Once
        you send, that conversation is between you and {SITE.name} on WhatsApp’s terms.
      </p>
      <h2>Contact form</h2>
      <p>
        The contact page only opens WhatsApp with your name, phone, and message. We do not run our
        own mail server on this site.
      </p>
      <h2>Your choices</h2>
      <p>
        Clear the ticket in the menu, clear site data in the browser, or message us on WhatsApp to
        ask about an order you already sent.
      </p>
    </LegalShell>
  );
}

export function TermsView() {
 const {settings:SITE}=useMenu();
  const { lang, t } = useLocale();
  const wa = `https://wa.me/${SITE.whatsappE164}`;
  if (lang === "ar") {
    return (
      <LegalShell title={t.termsTitle}>
        <p>{t.termsUpdated}</p>
        <p>
          هذا الموقع قائمة رقمية لسوشينا. ليس صفحة دفع. إضافة الأصناف إلى الطلب لا تنشئ طلباً مدفوعاً
          إلى أن يؤكده الفريق على واتساب أو عند الكاشير.
        </p>
        <h2>الأسعار</h2>
        <p>
          الأسعار بالريال القطري وتتبع الخيارات التي تختارها (البروتين، عدد القطع، الصوص، الإضافات).
          قد تختلف أسعار المنصات الأخرى. المطبخ يؤكد المجموع النهائي.
        </p>
        <h2>التوفر</h2>
        <p>
          قد تنفد بعض الأطباق. قد نرفض الطلب أو نعدّله إذا لم يتوفر صنف، أو إذا كان الطلب ناقصاً، أو
          إذا تعذر التوصيل إلى منطقتك في ذلك الوقت.
        </p>
        <h2>الحساسية</h2>
        <p>
          وصف القائمة يذكر المكونات المعتادة. أخبرنا عن أي حساسية على واتساب قبل التحضير. احتمال
          التلامس في مطبخ السوشي قائم.
        </p>
        <h2>استخدام الموقع</h2>
        <p>لا تنسخ القائمة بشكل مسيء أو تثقل الموقع. المحتوى والصور وعلامة سوشينا ملك لسوشينا.</p>
        <h2>التواصل</h2>
        <p>
          واتساب <a href={wa}>{SITE.whatsappDisplay}</a>. {t.address}.
        </p>
      </LegalShell>
    );
  }
  return (
    <LegalShell title={t.termsTitle}>
      <p>{t.termsUpdated}</p>
      <p>
        This site is a digital menu for {SITE.name}. It is not a checkout. Adding items to a ticket
        does not create a paid order until our team confirms it on WhatsApp or at the counter.
      </p>
      <h2>Prices</h2>
      <p>
        Prices are in Qatari riyal (QAR) and follow the options you pick (protein, pieces, sauce,
        extras). Printed or in-app prices on delivery platforms may differ. The kitchen confirms the
        final total.
      </p>
      <h2>Availability</h2>
      <p>
        Dishes can sell out. We may refuse or change an order if an item is unavailable, if the
        ticket is incomplete, or if we cannot deliver to your area at that time.
      </p>
      <h2>Allergens</h2>
      <p>
        Menu copy lists typical ingredients. Tell us allergies on WhatsApp before we prepare food.
        Cross-contact in a sushi kitchen is possible.
      </p>
      <h2>Use of the site</h2>
      <p>
        Do not scrape, overload, or misuse the menu. Content, photos, and the {SITE.name} marks
        belong to {SITE.name}.
      </p>
      <h2>Contact</h2>
      <p>
        WhatsApp <a href={wa}>{SITE.whatsappDisplay}</a>. {SITE.addressLine}.
      </p>
    </LegalShell>
  );
}

export function ContactView() {
 const {settings:SITE}=useMenu();
  const { t } = useLocale();
  return (
    <LegalShell title={t.contactTitle}>
      <p>
        {t.contactLead}{" "}
        <a href={`https://wa.me/${SITE.whatsappE164}`}>{SITE.whatsappDisplay}</a>.
      </p>
      <p>{t.address}.</p>
      <ContactForm />
    </LegalShell>
  );
}

export function ThankYouView() {
 const {settings:SITE}=useMenu();
  const { t } = useLocale();
  return (
    <LegalShell title={t.thankTitle}>
      <p>{t.thankBody}</p>
      <p>
        {t.whatsapp}{" "}
        <a className="doc-cta" href={`https://wa.me/${SITE.whatsappE164}`}>
          {SITE.whatsappDisplay}
        </a>
      </p>
      <p>
        <Link className="doc-cta" href="/">
          {t.backToMenu}
        </Link>
      </p>
    </LegalShell>
  );
}

export function MissingView() {
  const { t } = useLocale();
  return (
    <LegalShell title={t.missingTitle}>
      <p>{t.missingBody}</p>
      <p>
        <Link className="doc-cta" href="/">
          {t.backToMenu}
        </Link>
      </p>
    </LegalShell>
  );
}
