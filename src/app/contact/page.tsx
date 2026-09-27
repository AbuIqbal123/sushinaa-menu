import { ContactView } from "@/components/site/DocViews";
import { pageMeta } from "@/lib/page-meta";

export function generateMetadata() {
  return pageMeta((t) => t.contactTitle, (t) => t.contactBlurb, "/contact");
}

export default function ContactPage() {
  return <ContactView />;
}
