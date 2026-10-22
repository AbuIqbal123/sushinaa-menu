import { redirect } from "next/navigation";
import { getMenu } from "@/cms/repository";
import { MenuProvider } from "@/cms/context";
import { publicMenu } from "@/cms/schema";
import { MenuFeed } from "@/components/menu/MenuFeed";
import { pageMeta } from "@/lib/page-meta";

export function generateMetadata() {
  return pageMeta((t) => t.menu, (t) => t.menuBlurb, "");
}

export default async function Home() {
  if (process.env.NEXT_PUBLIC_ORDERING_DEMO_MODE === 'true') redirect('/order');
  const { menu } = await getMenu();
  return (
    <div className="app-lock">
      <MenuProvider menu={publicMenu(menu)}>
        <MenuFeed />
      </MenuProvider>
    </div>
  );
}
