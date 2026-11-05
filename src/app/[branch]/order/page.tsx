import { notFound } from 'next/navigation';
import { BRANCHES, findBranch } from '@/branches/branches';
import { getMenu } from '@/cms/repository';
import { MenuProvider } from '@/cms/context';
import { publicMenu } from '@/cms/schema';
import { OrderingExperience } from '@/components/checkout/OrderingExperience';
import { orderingEnabled } from '@/ordering/config';
import { pageMeta } from '@/lib/page-meta';
import '../../order/order.css';

type Props = {
  params: Promise<{ branch: string }>;
  searchParams: Promise<{ paid?: string | string[]; pay?: string | string[] }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return BRANCHES.map((b) => ({ branch: b.slug }));
}

export async function generateMetadata({ params }: Props) {
  const branch = findBranch((await params).branch);
  if (!branch) return {};
  return pageMeta((t) => t.thankTitle, (t) => t.thankBlurb, `/${branch.slug}/order`);
}

/**
 * Sadad (and mock) browser return. Kept off the static menu shell so `?paid=`
 * never paints the branch homepage before the receipt loads.
 */
export default async function BranchOrderReturn({ params, searchParams }: Props) {
  const branch = findBranch((await params).branch);
  if (!branch || !orderingEnabled(branch.slug)) notFound();
  const sp = await searchParams;
  const paidRaw = Array.isArray(sp.paid) ? sp.paid[0] : sp.paid;
  const returnPaidId = paidRaw && /^SU-[0-9a-f-]{36}$/.test(paidRaw) ? paidRaw : undefined;
  const payRaw = Array.isArray(sp.pay) ? sp.pay[0] : sp.pay;
  const payFailed = payRaw === 'failed';
  const { menu } = await getMenu();
  return (
    <MenuProvider menu={publicMenu(menu)}>
      <OrderingExperience
        initialNow={new Date().toISOString()}
        branchId={branch.slug}
        returnPaidId={returnPaidId}
        payFailed={payFailed}
      />
    </MenuProvider>
  );
}
