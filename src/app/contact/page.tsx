import type { Metadata } from "next";
import { ContactForm } from "@/components/ContactForm";
import { LegalShell } from "@/components/LegalShell";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description: `Message ${SITE.name} on WhatsApp ${SITE.whatsappDisplay}. Delivery across Doha.`,
  alternates: { canonical: `${SITE.url}/contact` },
};

export default function ContactPage() {
  return (
    <LegalShell title="Contact">
      <p>
        You call, we roll. WhatsApp is the line:{" "}
        <a href={`https://wa.me/${SITE.whatsappE164}`}>{SITE.whatsappDisplay}</a>.
      </p>
      <p>{SITE.addressLine}.</p>
      <ContactForm />
    </LegalShell>
  );
}
