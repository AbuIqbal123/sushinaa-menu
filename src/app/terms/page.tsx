import { TermsView } from "@/components/site/DocViews";
import { pageMeta } from "@/lib/page-meta";

export function generateMetadata() {
  return pageMeta((t) => t.termsTitle, (t) => t.termsBlurb, "/terms");
}

export default function TermsPage() {
  return <TermsView />;
}
