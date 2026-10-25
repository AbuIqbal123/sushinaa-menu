import { notFound, redirect } from 'next/navigation';
import { currentStaff } from '@/cms/auth';
import { Receipt } from '@/components/order/Receipt';
import { formatQar } from '@/lib/money';
import type { Copy } from '@/i18n/copy';
import { OrderError } from '@/ordering/http';
import { applyEdits, linesFromSnapshot } from '@/ordering/edits';
import { storedEdits } from '@/ordering/order-edits';
import { orderEditMeta } from '@/ordering/orders';
import { selectionLabel } from '@/ordering/price';
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
    const meta = await orderEditMeta(id);
    const reasonFor = (lineId: string | null) => {
      const edit = [...meta.edits].reverse().find((item) => item.lineId === lineId && (lineId ? item.kind.includes('discount') || item.kind === 'order_discount' : item.kind === 'order_discount'));
      return edit ? `${edit.reasonCode.replaceAll('_', ' ')}${edit.note ? ` (${edit.note})` : ''}` : '';
    };
    const copy = { pcs: 'pcs', dip: 'Dip', spicy: 'Spicy', regular: 'Regular' } as Copy;
    const lineDiscounts = projected.discounts.filter((item) => item.scope === 'line');
    const orderDiscounts = projected.discounts.filter((item) => item.scope === 'order');
    const discountTotal = projected.discounts.reduce((sum, item) => sum + item.amountMinor, 0);
    const subtotal = Number(row.total_minor) + discountTotal;
    model = {
      branchName: snapshot.branchName || 'Sushinaa',
      orderNumber: row.order_number == null ? '' : String(row.order_number),
      id: String(row.id),
      when: new Date(String(row.created_at)).toLocaleString('en', { timeZone: 'Asia/Qatar' }),
      amended: Boolean(row.amended_at),
      lines: projected.lines.map((line) => {
        const off = lineDiscounts.find((item) => item.lineId === line.id);
        const modifiers = line.kind ? selectionLabel({ kind: line.kind as never, freeDips: line.freeDips as never, extras: line.extras as never }, line.selection, 'en', copy) : '';
        return {
          qty: line.quantity,
          name: line.name,
          unit: price(line.unitMinor),
          total: price(line.voided || line.compliment ? 0 : line.unitMinor * line.quantity),
          modifiers,
          voided: line.voided,
          discount: off ? `Discount ${price(-off.amountMinor)} ${reasonFor(line.id)}` : '',
        };
      }),
      discounts: orderDiscounts.map((item) => ({ label: `Order discount ${reasonFor(null)}`, amount: price(-item.amountMinor) })),
      subtotal: price(subtotal),
      discountTotal: price(-discountTotal),
      total: price(Number(row.total_minor)),
      payment: row.paid_at ? `Paid ${price(Number(row.total_minor))}` : 'Pay at pickup',
      owed: meta.owedBackMinor > 0 ? `Owed back ${price(meta.owedBackMinor)}` : '',
    };
  } catch (error) {
    if (error instanceof OrderError && error.code === 'NOT_FOUND') notFound();
    throw error;
  }
  return <Receipt model={model} />;
}
