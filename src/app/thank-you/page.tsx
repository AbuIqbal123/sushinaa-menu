import type { Metadata } from "next";
import Link from "next/link";
import { LegalShell } from "@/components/LegalShell";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Thank you",
  description: `Ticket sent. ${SITE.name} will confirm your order on WhatsApp.`,
  alternates: { canonical: `${SITE.url}/thank-you` },
};

export default function ThankYouPage() {
  return (
    <LegalShell title="Thank you">
      <p>
        If WhatsApp opened, send the ticket there. We will confirm items, time, and the total in
        QAR before we start rolling.
      </p>
      <p>
        WhatsApp{" "}
        <a className="doc-cta" href={`https://wa.me/${SITE.whatsappE164}`}>
          {SITE.whatsappDisplay}
        </a>
      </p>
      <p>
        <Link className="doc-cta" href="/">
          Back to the menu
        </Link>
      </p>
    </LegalShell>
  );
}
