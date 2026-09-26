import { ThankYouView } from "@/components/DocViews";
import { pageMeta } from "@/lib/page-meta";

export function generateMetadata() {
  return pageMeta((t) => t.thankTitle, (t) => t.thankBlurb, "/thank-you");
}

export default function ThankYouPage() {
  return <ThankYouView />;
}
