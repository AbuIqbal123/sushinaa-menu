import type { Metadata } from "next";
import { LegalShell } from "@/components/LegalShell";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: `How ${SITE.name} uses the ticket on your device, WhatsApp, and optional analytics.`,
  alternates: { canonical: `${SITE.url}/privacy` },
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy policy">
      <p>Last updated 20 September 2026.</p>
      <p>
        {SITE.name} ({SITE.nameAr}) is a sushi kitchen in Qatar. This QR menu lets you build a
        ticket and send it to us on WhatsApp. We do not take payment on this website.
      </p>
      <h2>Who we are</h2>
      <p>
        Contact: WhatsApp{" "}
        <a href={`https://wa.me/${SITE.whatsappE164}`}>{SITE.whatsappDisplay}</a>. Instagram{" "}
        <a href={SITE.instagram}>{SITE.instagramHandle}</a>. Delivery areas include{" "}
        {SITE.areas.join(", ")}.
      </p>
      <h2>What we store on your device</h2>
      <p>
        Your ticket (dish names, options, quantities) is saved in the browser with{" "}
        <code>localStorage</code> so a refresh does not empty the order. That storage stays on
        your phone unless you clear the ticket or site data. It is necessary for the menu to
        work.
      </p>
      <p>
        Cookie consent is also stored locally so we do not ask again on every visit.
      </p>
      <h2>Optional analytics</h2>
      <p>
        If you tap “Accept analytics”, we load Vercel Analytics to see anonymous page views and
        performance. If you choose “Necessary only”, that script does not run.
      </p>
      <h2>WhatsApp</h2>
      <p>
        Sending a ticket opens WhatsApp with a pre-filled message. WhatsApp is Meta’s product.
        Once you send, that conversation is between you and {SITE.name} on WhatsApp’s terms.
      </p>
      <h2>Contact form</h2>
      <p>
        The contact page only opens WhatsApp with your name, phone, and message. We do not run
        our own mail server on this site.
      </p>
      <h2>Your choices</h2>
      <p>
        Clear the ticket in the menu, clear site data in the browser, or message us on WhatsApp
        to ask about an order you already sent.
      </p>
    </LegalShell>
  );
}
