import type { Metadata } from "next";
import { LegalShell } from "@/components/LegalShell";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms and conditions",
  description: `Terms for using the ${SITE.name} QR menu. Prices in QAR. No payment on this site.`,
  alternates: { canonical: `${SITE.url}/terms` },
};

export default function TermsPage() {
  return (
    <LegalShell title="Terms and conditions">
      <p>Last updated 20 September 2026.</p>
      <p>
        This site is a digital menu for {SITE.name}. It is not a checkout. Adding items to a
        ticket does not create a paid order until our team confirms it on WhatsApp or at the
        counter.
      </p>
      <h2>Prices</h2>
      <p>
        Prices are in Qatari riyal (QAR) and follow the options you pick (protein, pieces,
        sauce, extras). Printed or in-app prices on delivery platforms may differ. The kitchen
        confirms the final total.
      </p>
      <h2>Availability</h2>
      <p>
        Dishes can sell out. We may refuse or change an order if an item is unavailable, if the
        ticket is incomplete, or if we cannot deliver to your area at that time.
      </p>
      <h2>Allergens</h2>
      <p>
        Menu copy lists typical ingredients. Tell us allergies on WhatsApp before we prepare
        food. Cross-contact in a sushi kitchen is possible.
      </p>
      <h2>Use of the site</h2>
      <p>
        Do not scrape, overload, or misuse the menu. Content, photos, and the {SITE.name} marks
        belong to {SITE.name}.
      </p>
      <h2>Contact</h2>
      <p>
        WhatsApp <a href={`https://wa.me/${SITE.whatsappE164}`}>{SITE.whatsappDisplay}</a>.{" "}
        {SITE.addressLine}.
      </p>
    </LegalShell>
  );
}
