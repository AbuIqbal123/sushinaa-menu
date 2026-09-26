import type { Metadata } from "next";
import { ThankYouView } from "@/components/DocViews";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Thank you",
  description: `Ticket sent. ${SITE.name} will confirm your order on WhatsApp.`,
  alternates: { canonical: `${SITE.url}/thank-you` },
};

export default function ThankYouPage() {
  return <ThankYouView />;
}
