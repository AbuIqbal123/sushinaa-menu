import { notFound, redirect } from 'next/navigation';
import { currentStaff } from '@/cms/auth';
import { Receipt } from '@/components/order/Receipt';
import { formatQar } from '@/lib/money';
import { OrderError } from '@/ordering/http';
import { applyEdits, linesFromSnapshot } from '@/ordering/edits';
import { storedEdits } from '@/ordering/order-edits';
import { loadTicket } from '@/ordering/printing';

export const dynamic = 'force-dynamic';

const money = { currencyEn: 'QAR', currencyAr: 'ر.ق' };
const price = (minor: number) => formatQar(minor / 100, 'en', money);

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await currentStaff();
  if (!staff) redirect('/admin/login');
  let model;
  try {
    const id = (await params).id;
    const row = await loadTicket(staff.branchScope, id);
    const snapshot = JSON.parse(String(row.snapshot)) as { branchName?: string; lines?: Parameters<typeof linesFromSnapshot>[0]; totalMinor?: number };
    const projected = applyEdits(linesFromSnapshot(snapshot.lines ?? []), await storedEdits(id));
    model = {
      branchName: snapshot.branchName || 'Sushinaa',
      id: String(row.id),
      original: price(Number(snapshot.totalMinor ?? row.total_minor)),
      discounts: projected.discounts.map((line) => ({ label: line.scope === 'order' ? 'Order discount' : 'Discount', amount: price(-line.amountMinor) })),
      total: price(Number(row.total_minor)),
      payment: row.paid_at ? 'Paid' : 'Unpaid',
    };
  } catch (error) {
    if (error instanceof OrderError && error.code === 'NOT_FOUND') notFound();
    throw error;
  }
  return <Receipt model={model} />;
}
