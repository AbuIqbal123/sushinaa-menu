import { PrivacyView } from "@/components/DocViews";
import { pageMeta } from "@/lib/page-meta";

export function generateMetadata() {
  return pageMeta((t) => t.privacyTitle, (t) => t.privacyBlurb, "/privacy");
}

export default function PrivacyPage() {
  return <PrivacyView />;
}
