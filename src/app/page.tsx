import { MenuFeed } from "@/components/menu/MenuFeed";
import { pageMeta } from "@/lib/page-meta";

export function generateMetadata() {
  return pageMeta((t) => t.menu, (t) => t.menuBlurb, "");
}

export default function Home() {
  return (
    <div className="app-lock">
      <MenuFeed />
    </div>
  );
}
