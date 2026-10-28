import { BranchPicker } from "@/components/branch/BranchPicker";
import { requestLang } from "@/i18n/request-lang";
import { pageMeta } from "@/lib/page-meta";

// Returning visitors never see this page: src/proxy.ts sends them to their branch.
export async function generateMetadata() {
  const lang = await requestLang();
  return pageMeta((t) => `${lang === "ar" ? "اختر فرعك" : "Choose your branch"} · ${t.brand}`, (t) => t.menuBlurb, "");
}

export default function Home() {
  return <BranchPicker />;
}
