import { z } from 'zod';
import type { Selection } from '@/catalog/types';
import { selectionSchema } from './checkout/validation';

/** Editable while the kitchen still owns the order. */
export const editableStatuses = ['placed', 'paid', 'accepted', 'preparing', 'ready'] as const;

export const editReasons = [
  'customer_request', 'wrong_item', 'item_unavailable', 'quality_issue',
  'staff_error', 'goodwill', 'loyalty', 'other',
] as const;
export type EditReason = typeof editReasons[number];

/** Last-line void uses the existing cancel reasons. */
export const cancelReasonFor: Record<EditReason, 'customer_request' | 'unavailable' | 'duplicate' | 'branch_closed'> = {
  customer_request: 'customer_request',
  wrong_item: 'customer_request',
  item_unavailable: 'unavailable',
  quality_issue: 'customer_request',
  staff_error: 'customer_request',
  goodwill: 'customer_request',
  loyalty: 'customer_request',
  other: 'customer_request',
};

export type Discount =
  | { mode: 'percent'; bp: number }
  | { mode: 'amount'; amountMinor: number };

export type WorkingLine = {
  id: string;
  dishId: string;
  name: string;
  nameAr: string;
  quantity: number;
  unitMinor: number;
  note: string;
  voided: boolean;
  compliment: boolean;
  discount: Discount | null;
  selection: Selection;
  categoryName: string;
  categoryNameAr: string;
  categoryOrder: number;
  kind?: unknown;
  freeDips?: unknown;
  extras?: unknown;
};

export type DiscountLine = {
  scope: 'line' | 'order';
  lineId: string | null;
  amountMinor: number;
};

export type ResolvedEdit =
  | { kind: 'line_price'; lineId: string; unitMinor: number }
  | { kind: 'void'; lineId: string }
  | { kind: 'qty'; lineId: string; quantity: number }
  | { kind: 'modifier'; lineId: string; selection: Selection; unitMinor: number }
  | { kind: 'add_item'; line: WorkingLine }
  | { kind: 'compliment'; lineId: string }
  | { kind: 'line_discount'; lineId: string; discount: Discount }
  | { kind: 'order_discount'; discount: Discount };

export class EditRejection extends Error {
  constructor(public code: 'BELOW_ZERO' | 'UNKNOWN_LINE') { super(code); }
}

/** Half up for a percent expressed in basis points (100% = 10000). */
export function percentOff(base: number, bp: number) {
  return Math.floor((base * bp + 5000) / 10000);
}

type SnapshotLine = {
  dishId?: string;
  name?: string;
  nameAr?: string;
  quantity?: number;
  unitMinor?: number;
  totalMinor?: number;
  note?: string;
  selection?: Selection;
  categoryName?: string;
  categoryNameAr?: string;
  categoryOrder?: number;
  kind?: unknown;
  freeDips?: unknown;
  extras?: unknown;
};

export function linesFromSnapshot(lines: SnapshotLine[]): WorkingLine[] {
  return lines.map((line, index) => ({
    id: `L${index}`,
    dishId: line.dishId ?? '',
    name: line.name || 'Item',
    nameAr: line.nameAr || line.name || 'Item',
    quantity: line.quantity ?? 1,
    unitMinor: line.unitMinor ?? (line.quantity ? Math.round((line.totalMinor ?? 0) / line.quantity) : (line.totalMinor ?? 0)),
    note: line.note ?? '',
    voided: false,
    compliment: false,
    discount: null,
    selection: line.selection ?? {},
    categoryName: line.categoryName || 'Items',
    categoryNameAr: line.categoryNameAr || '',
    categoryOrder: line.categoryOrder ?? index,
    kind: line.kind,
    freeDips: line.freeDips,
    extras: line.extras,
  }));
}

function clone(lines: WorkingLine[]): WorkingLine[] {
  return lines.map((line) => ({ ...line, selection: { ...line.selection }, discount: line.discount ? { ...line.discount } : null }));
}

function lineById(lines: WorkingLine[], id: string) {
  const line = lines.find((item) => item.id === id);
  if (!line || line.voided) throw new EditRejection('UNKNOWN_LINE');
  return line;
}

function netOf(gross: number, discount: Discount | null, compliment: boolean) {
  if (compliment) return 0;
  if (!discount) return gross;
  const off = discount.mode === 'percent' ? percentOff(gross, discount.bp) : discount.amountMinor;
  const net = gross - off;
  if (net < 0) throw new EditRejection('BELOW_ZERO');
  return net;
}

export type EditProjection = {
  lines: WorkingLine[];
  totalMinor: number;
  discounts: DiscountLine[];
  activeCount: number;
};

/** Replay edits onto the original lines. Does not read or write a total from the caller. */
export function applyEdits(snapshotLines: WorkingLine[], edits: ResolvedEdit[]): EditProjection {
  const lines = clone(snapshotLines);
  let orderDiscount: Discount | null = null;
  for (const edit of edits) {
    if (edit.kind === 'add_item') {
      lines.push({ ...edit.line, selection: { ...edit.line.selection }, discount: edit.line.discount ? { ...edit.line.discount } : null });
      continue;
    }
    if (edit.kind === 'order_discount') {
      orderDiscount = { ...edit.discount };
      continue;
    }
    const line = lineById(lines, edit.lineId);
    if (edit.kind === 'line_price') line.unitMinor = edit.unitMinor;
    else if (edit.kind === 'void') line.voided = true;
    else if (edit.kind === 'qty') line.quantity = edit.quantity;
    else if (edit.kind === 'modifier') {
      line.selection = { ...edit.selection };
      line.unitMinor = edit.unitMinor;
    } else if (edit.kind === 'compliment') {
      line.compliment = true;
      line.discount = null;
    } else if (edit.kind === 'line_discount') {
      line.compliment = false;
      line.discount = { ...edit.discount };
    }
  }
  const discounts: DiscountLine[] = [];
  let subtotal = 0;
  for (const line of lines) {
    if (line.voided) continue;
    const gross = line.unitMinor * line.quantity;
    const net = netOf(gross, line.discount, line.compliment);
    const off = gross - net;
    if (off > 0) discounts.push({ scope: 'line', lineId: line.id, amountMinor: off });
    subtotal += net;
  }
  const totalMinor = netOf(subtotal, orderDiscount, false);
  if (orderDiscount) {
    const off = subtotal - totalMinor;
    if (off > 0) discounts.push({ scope: 'order', lineId: null, amountMinor: off });
  }
  if (totalMinor < 0) throw new EditRejection('BELOW_ZERO');
  return { lines, totalMinor, discounts, activeCount: lines.filter((line) => !line.voided).length };
}

export type OrderTotals = { subtotalMinor: number; discountMinor: number; totalMinor: number };

/**
 * The one place order money is split for display. Subtotal is every live line at
 * its full price (comps included), before any discount. Discounts & comps is the
 * gap to the total, so the three rows always add up.
 */
export function orderTotals(order: {
  lines: readonly { voided: boolean; unitMinor: number; quantity: number }[];
  totalMinor: number;
}): OrderTotals {
  const subtotalMinor = order.lines.reduce((sum, line) => (line.voided ? sum : sum + line.unitMinor * line.quantity), 0);
  if (!Number.isSafeInteger(subtotalMinor) || !Number.isSafeInteger(order.totalMinor)) throw new RangeError('Money must be integer minor units');
  return { subtotalMinor, discountMinor: subtotalMinor - order.totalMinor, totalMinor: order.totalMinor };
}

export type EditPreview = {
  subtotalMinor: number;
  changeMinor: number;
  totalMinor: number;
  /** The current total, only when the edit changes it. */
  wasMinor: number | null;
  /** Owed back after this edit, only on a paid order. */
  owedBackMinor: number | null;
  /** A paid order can't go up. */
  blocked: boolean;
};

/** What an edit sheet or confirm shows: the new order next to the current one. */
export function editPreview(current: OrderTotals, next: OrderTotals, paid: { paid: boolean; owedBackMinor: number }): EditPreview {
  const changeMinor = next.totalMinor - current.totalMinor;
  return {
    subtotalMinor: next.subtotalMinor,
    changeMinor,
    totalMinor: next.totalMinor,
    wasMinor: changeMinor === 0 ? null : current.totalMinor,
    owedBackMinor: paid.paid ? paid.owedBackMinor + Math.max(0, -changeMinor) : null,
    blocked: paid.paid && changeMinor > 0,
  };
}

/** Reason labels shared by the CMS and the printed receipt. */
export const editReasonLabels: Record<EditReason, { en: string; ar: string }> = {
  customer_request: { en: 'Customer request', ar: 'طلب العميل' },
  wrong_item: { en: 'Wrong item', ar: 'صنف خاطئ' },
  item_unavailable: { en: 'Item unavailable', ar: 'الصنف غير متوفر' },
  quality_issue: { en: 'Quality issue', ar: 'مشكلة في الجودة' },
  staff_error: { en: 'Staff error', ar: 'خطأ الموظف' },
  goodwill: { en: 'Goodwill', ar: 'مجاملة' },
  loyalty: { en: 'Loyalty', ar: 'ولاء' },
  other: { en: 'Other', ar: 'أخرى' },
};

export function editReasonLabel(code: string, lang: 'en' | 'ar') {
  return editReasonLabels[code as EditReason]?.[lang] ?? code.replaceAll('_', ' ');
}

/** The short order code staff read out ("SU-591e5873"), never the full id. */
export function orderShortCode(id: string) {
  return id.slice(0, 11);
}

const reasonCode = z.enum(editReasons);
const note = z.string().trim().max(140).optional();
const lineId = z.string().min(1).max(40);
const discountShape = {
  mode: z.enum(['percent', 'amount']),
  bp: z.number().int().min(1).max(10000).optional(),
  amountMinor: z.number().int().positive().optional(),
};
function discountOk(value: { mode: 'percent' | 'amount'; bp?: number; amountMinor?: number }) {
  return value.mode === 'percent' ? value.bp != null && value.amountMinor == null : value.amountMinor != null && value.bp == null;
}

export const editBody = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('line_price'), lineId, unitMinor: z.number().int().min(0), reasonCode, note }).strict(),
  z.object({ kind: z.literal('void'), lineId, reasonCode, note }).strict(),
  z.object({ kind: z.literal('qty'), lineId, quantity: z.number().int().min(1).max(20), reasonCode, note }).strict(),
  z.object({ kind: z.literal('modifier'), lineId, selection: selectionSchema, reasonCode, note }).strict(),
  z.object({ kind: z.literal('add_item'), dishId: z.string().min(1).max(100), selection: selectionSchema, quantity: z.number().int().min(1).max(20), lineNote: z.string().trim().max(400).optional(), reasonCode, note }).strict(),
  z.object({ kind: z.literal('compliment'), lineId, reasonCode, note }).strict(),
  z.object({ kind: z.literal('line_discount'), lineId, ...discountShape, reasonCode, note }).strict().refine(discountOk),
  z.object({ kind: z.literal('order_discount'), ...discountShape, reasonCode, note }).strict().refine(discountOk),
]);
export type EditBody = z.infer<typeof editBody>;

/** Drop a client total or price before validation. unitMinor on a price change stays. */
export function parseEditBody(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return editBody.parse(input);
  const copy = { ...(input as Record<string, unknown>) };
  delete copy.total;
  delete copy.totalMinor;
  delete copy.price;
  return editBody.parse(copy);
}

export function discountFrom(body: { mode: 'percent' | 'amount'; bp?: number; amountMinor?: number }): Discount {
  return body.mode === 'percent' ? { mode: 'percent', bp: body.bp! } : { mode: 'amount', amountMinor: body.amountMinor! };
}
