import type { Metadata } from "next";
import { PrivacyView } from "@/components/DocViews";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: `How ${SITE.name} uses the ticket on your device, WhatsApp, and anonymous analytics.`,
  alternates: { canonical: `${SITE.url}/privacy` },
};

export default function PrivacyPage() {
  return <PrivacyView />;
}
