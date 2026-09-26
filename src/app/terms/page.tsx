import type { Metadata } from "next";
import { TermsView } from "@/components/DocViews";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms and conditions",
  description: `Terms for using the ${SITE.name} QR menu. Prices in QAR. No payment on this site.`,
  alternates: { canonical: `${SITE.url}/terms` },
};

export default function TermsPage() {
  return <TermsView />;
}
