import type { Row } from '@libsql/client';
import type { Copy } from '@/i18n/copy';
import { carBrandName } from './car-brands';
import { BRANCHES } from '@/branches/branches';
import { formatOrderNumber } from '@/ordering/order-number';
import { minorAmount, formatQar } from '@/lib/money';
import { selectionLabel } from '@/ordering/price';
import { nationalPhone } from '@/ordering/checkout/validation';
import type { Selection } from '@/catalog/types';
import { applyEdits, linesFromSnapshot, type ResolvedEdit } from '@/ordering/edits';

const ticketCopy = { pcs: 'pcs', spicy: 'Spicy', regular: 'Regular', dip: 'Dip' } as Copy;
const money = { currencyEn: 'QAR', currencyAr: 'ر.ق' };

export type TicketLine = {
  name: string;
  nameAr?: string;
  amount?: string;
  quantity: number;
  note: string;
  total: string;
  options: string;
  voided: boolean;
};
export type TicketGroup = { name: string; lines: TicketLine[] };
export type TicketModel = {
  branchName: string;
  orderNumber: string;
  id: string;
  placed: string;
  fulfilment: string;
  car: string;
  brand: string;
  vehicle: string;
  customer: string;
  phone: string;
  groups: TicketGroup[];
  total: string;
  payment: string;
  reprint: string | null;
  amended: boolean;
  reference: string;
  amountDue: string;
  subtotal: string;
  discount: string;
  instructions: string;
};

type StoredLine = {
  name?: string;
  quantity?: number;
  note?: string;
  totalMinor?: number;
  categoryName?: string;
  categoryOrder?: number;
  selection?: Selection;
  kind?: Parameters<typeof selectionLabel>[0]['kind'];
  freeDips?: Parameters<typeof selectionLabel>[0]['freeDips'];
  extras?: Parameters<typeof selectionLabel>[0]['extras'];
};

export function qatarTime(iso: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Qatar',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${pick('year')}-${pick('month')}-${pick('day')} ${pick('hour')}:${pick('minute')}`;
}

export function receiptReference(iso: string, branchId: string, number: string) {
  const date = qatarTime(iso).slice(2, 10).replaceAll('-', '');
  const branch = BRANCHES.find(b => b.slug === branchId)?.code ?? String(BRANCHES.findIndex(b => b.slug === branchId) + 1).padStart(2, '0');
  return `${date}${branch}${number.padStart(6, '0')}`;
}

function price(minor: number) {
  return formatQar(minor / 100, 'en', money);
}

function options(line: StoredLine) {
  if (!line.kind || !line.selection) return '';
  return selectionLabel(
    { kind: line.kind, freeDips: line.freeDips, extras: line.extras },
    line.selection,
    'en',
    ticketCopy,
  );
}

export function ticketModel(row: Row, edits: ResolvedEdit[] = []): TicketModel {
  const snapshot = JSON.parse(String(row.snapshot)) as {
    version?: number;
    branchName?: string;
    collection?: string;
    customer?: { brand?: string } | null;
    lines?: StoredLine[];
    totalMinor?: number;
  };
  const removed = row.customer_name == null && row.customer_phone == null;
  const projected = applyEdits(linesFromSnapshot(snapshot.lines ?? []), edits);
  const groups = new Map<string, { order: number; lines: TicketLine[] }>();
  for (const line of projected.lines) {
    const name = snapshot.version === 1 || !line.categoryName ? 'Items' : line.categoryName;
    const group = groups.get(name) ?? { order: line.categoryOrder ?? groups.size, lines: [] };
    const gross = line.voided ? 0 : line.unitMinor * line.quantity;
    group.lines.push({
      name: line.voided ? `VOID ${line.name}` : line.name,
      nameAr: line.nameAr !== line.name ? line.nameAr : '',
      amount: minorAmount(gross),
      quantity: line.quantity,
      note: line.note || '',
      total: price(line.voided ? 0 : gross),
      options: options(line as StoredLine),
      voided: line.voided,
    });
    const discount = projected.discounts.find((item) => item.scope === 'line' && item.lineId === line.id);
    if (discount) {
      group.lines.push({
        name: line.compliment ? 'Compliment' : 'Discount',
        amount: minorAmount(-discount.amountMinor),
        quantity: 1,
        note: '',
        total: price(-discount.amountMinor),
        options: '',
        voided: false,
      });
    }
    groups.set(name, group);
  }
  const orderDiscount = projected.discounts.find((item) => item.scope === 'order');
  if (orderDiscount) {
    const group = groups.get('Items') ?? { order: 1000, lines: [] };
    group.lines.push({ name: 'Discount', amount: minorAmount(-orderDiscount.amountMinor), quantity: 1, note: '', total: price(-orderDiscount.amountMinor), options: '', voided: false });
    groups.set('Items', group);
  }
  const car = typeof row.car_plate === 'string' ? row.car_plate : '';
  const brand = removed ? '' : carBrandName(snapshot.customer?.brand);
  const vehicle = [row.car_colour, row.car_model].filter((part) => typeof part === 'string' && part).join(' · ');
  const printCount = Number(row.print_count ?? 0);
  return {
    branchName: snapshot.branchName || 'Sushinaa',
    orderNumber: formatOrderNumber(row.order_number == null ? '' : Number(row.order_number)),
    id: String(row.id),
    placed: qatarTime(String(row.created_at)),
    fulfilment: 'CAR PICKUP',
    car,
    brand,
    vehicle,
    customer: removed ? 'removed' : (typeof row.customer_name === 'string' && row.customer_name ? row.customer_name : 'removed'),
    phone: removed ? 'removed' : nationalPhone(String(row.customer_phone ?? '')),
    groups: [...groups.entries()]
      .sort((a, b) => a[1].order - b[1].order)
      .map(([name, group]) => ({ name, lines: group.lines })),
    total: price(Number(row.total_minor)),
    payment: `${row.paid_at ? 'Paid' : 'Unpaid'} · ${String(row.payment_method)}`,
    reprint: row.printed_at ? `Reprint ${printCount}` : null,
    amended: row.amended_at != null && row.amended_at !== '',
    reference: receiptReference(String(row.created_at), String(row.branch_id), row.order_number == null ? '0' : String(row.order_number)),
    amountDue: minorAmount(Number(row.total_minor)),
    subtotal: minorAmount(projected.lines.filter(line => !line.voided).reduce((n, line) => n + line.unitMinor * line.quantity, 0)),
    discount: minorAmount(projected.discounts.reduce((n, discount) => n + discount.amountMinor, 0)),
    instructions: typeof row.instructions === 'string' ? row.instructions : '',
  };
}
