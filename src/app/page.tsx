import { BranchPicker } from "@/components/branch/BranchPicker";
import { pageMeta } from "@/lib/page-meta";

// Returning visitors never see this page: src/proxy.ts sends them to their branch.
export function generateMetadata() {
  return pageMeta((t) => `Choose your branch · ${t.brand}`, (t) => t.menuBlurb, "");
}

export default function Home() {
  return <BranchPicker />;
}
