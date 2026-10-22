import { notFound } from "next/navigation";
import { BRANCHES, findBranch } from "@/branches/branches";
import { getMenu } from "@/cms/repository";
import { MenuProvider } from "@/cms/context";
import { publicMenu } from "@/cms/schema";
import { MenuFeed } from "@/components/menu/MenuFeed";
import { pageMeta } from "@/lib/page-meta";

type Props = { params: Promise<{ branch: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return BRANCHES.map((b) => ({ branch: b.slug }));
}

export async function generateMetadata({ params }: Props) {
  const branch = findBranch((await params).branch);
  if (!branch) return {};
  return pageMeta((t) => `${t.menu} · ${branch.name}`, (t) => t.menuBlurb, `/${branch.slug}`);
}

// Every branch serves the same menu, prices and WhatsApp number.
export default async function BranchMenu({ params }: Props) {
  const branch = findBranch((await params).branch);
  if (!branch) notFound(); // the layout already 404s; this keeps the type narrow
  const { menu } = await getMenu();
  return (
    <div className="app-lock">
      <MenuProvider menu={publicMenu(menu)}>
        <MenuFeed branch={branch.name} />
      </MenuProvider>
    </div>
  );
}
