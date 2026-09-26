import type { Metadata } from "next";
import { ContactView } from "@/components/DocViews";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description: `Message ${SITE.name} on WhatsApp ${SITE.whatsappDisplay}. Delivery across Doha.`,
  alternates: { canonical: `${SITE.url}/contact` },
};

export default function ContactPage() {
  return <ContactView />;
}
