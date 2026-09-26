import { MissingView } from "@/components/DocViews";
import { pageMeta } from "@/lib/page-meta";

export function generateMetadata() {
  return pageMeta((t) => t.missingTitle, (t) => t.missingBlurb);
}

export default function NotFound() {
  return <MissingView />;
}
