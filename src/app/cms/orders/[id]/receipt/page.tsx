import { notFound, redirect } from 'next/navigation';
import { getMenu } from '@/cms/repository';
import { nationalPhone } from '@/ordering/checkout/validation';
import { receiptReference } from '@/ordering/ticket';
import { currentStaff } from '@/cms/auth';
import { Receipt, type CustomerReceipt, type ReceiptAdjustment } from '@/components/order/Receipt';
import { formatMinor, minorAmount } from '@/lib/money';
import type { Copy } from '@/i18n/copy';
import { OrderError } from '@/ordering/http';
import { applyEdits, editReasonLabel, linesFromSnapshot, orderShortCode, orderTotals } from '@/ordering/edits';
import { storedEdits } from '@/ordering/order-edits';
import { orderEditMeta } from '@/ordering/orders';
import { selectionLabel } from '@/ordering/price';
import { loadTicket } from '@/ordering/printing';

export const dynamic = 'force-dynamic';

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await currentStaff();
  if (!staff) redirect('/admin/login');
  let model: CustomerReceipt;
  try {
    const id = (await params).id;
    const row = await loadTicket(staff.branchScope, id);
    const snapshot = JSON.parse(String(row.snapshot)) as { branchName?: string; lines?: Parameters<typeof linesFromSnapshot>[0]; totalMinor?: number };
    const projected = applyEdits(linesFromSnapshot(snapshot.lines ?? []), await storedEdits(id));
    const meta = await orderEditMeta(id);
    const totals = orderTotals({ lines: projected.lines, totalMinor: Number(row.total_minor) });
    // The latest edit that explains a discount: a line's discount or comp, or the order discount.
    const editFor = (lineId: string | null) => [...meta.edits].reverse().find((item) => (lineId
      ? item.lineId === lineId && (item.kind === 'line_discount' || item.kind === 'compliment')
      : item.kind === 'order_discount'));
    const adjustment = (kind: string, lineId: string | null, amountMinor: number): ReceiptAdjustment => {
      const edit = editFor(lineId);
      return {
        label: edit ? `${kind} (${editReasonLabel(edit.reasonCode, 'en')})` : kind,
        amount: minorAmount(-amountMinor),
        note: edit?.note ?? '',
      };
    };
    const copy = { pcs: 'pcs', dip: 'Dip', spicy: 'Spicy', regular: 'Regular' } as Copy;
    const orderNumber = row.order_number == null ? '' : String(row.order_number);
    model = {
      branchName: snapshot.branchName || 'Sushinaa',
      orderLabel: orderNumber ? `Order ${orderNumber}` : `Order ${orderShortCode(String(row.id))}`,
      car: [row.car_plate, row.car_colour, row.car_model].filter(Boolean).join(' · '),
      customer: row.customer_name == null ? 'removed' : String(row.customer_name),
      phone: row.customer_phone == null ? 'removed' : nationalPhone(String(row.customer_phone)),
      reference: receiptReference(String(row.created_at), String(row.branch_id), orderNumber || '0'),
      when: new Date(String(row.created_at)).toLocaleString('en-GB', { timeZone: 'Asia/Qatar', dateStyle: 'medium', timeStyle: 'short' }),
      amended: Boolean(row.amended_at),
      lines: projected.lines.map((line) => {
        const off = line.voided ? undefined : projected.discounts.find((item) => item.scope === 'line' && item.lineId === line.id);
        const modifiers = line.kind ? selectionLabel({ kind: line.kind as never, freeDips: line.freeDips as never, extras: line.extras as never }, line.selection, 'en', copy) : '';
        return {
          name: line.name,
          nameAr: line.nameAr,
          quantity: line.quantity,
          note: line.note,
          qtyLine: `${line.quantity} x ${minorAmount(line.unitMinor)}`,
          total: minorAmount(line.voided ? 0 : line.unitMinor * line.quantity),
          modifiers,
          voided: line.voided,
          adjustments: off ? [adjustment(line.compliment ? 'Comp' : 'Discount', line.id, off.amountMinor)] : [],
        };
      }),
      orderAdjustments: projected.discounts.filter((item) => item.scope === 'order').map((item) => adjustment('Discount', null, item.amountMinor)),
      subtotal: minorAmount(totals.subtotalMinor),
      discountTotal: minorAmount(-totals.discountMinor),
      total: formatMinor(totals.totalMinor, 'en'),
      payment: row.paid_at ? { label: 'Paid', amount: minorAmount(totals.totalMinor) } : { label: 'Pay at pickup', amount: minorAmount(totals.totalMinor) },
      owed: meta.owedBackMinor > 0 ? { label: 'Owed back', amount: minorAmount(meta.owedBackMinor) } : null,
    };
  } catch (error) {
    if (error instanceof OrderError && error.code === 'NOT_FOUND') notFound();
    throw error;
  }
  const { menu } = await getMenu();
  return <Receipt model={model} logo={menu.settings.documentLogo || menu.settings.logo} />;
}
