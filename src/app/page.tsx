import { BranchPicker } from "@/components/branch/BranchPicker";
import { requestLang } from "@/i18n/request-lang";
import { pageMeta } from "@/lib/page-meta";

// Every visit to the menu link starts here. A branch address such as /al-thumama still opens that branch.
export async function generateMetadata() {
  const lang = await requestLang();
  return pageMeta((t) => `${lang === "ar" ? "اختر فرعك" : "Choose your branch"} · ${t.brand}`, (t) => t.menuBlurb, "");
}

export default function Home() {
  return <BranchPicker />;
}
