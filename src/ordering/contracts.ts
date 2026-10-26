import { z } from 'zod';
import { BRANCHES, type BranchId } from '@/branches/branches';
import { statuses, type OrderStatus, type PaymentMethod } from './status';
import type { OrderSnapshot } from './checkout/validation';
export const orderId = z.string().regex(/^SU-[0-9a-f-]{36}$/);
export const branchId = z.custom<BranchId>((v) => typeof v === 'string' && BRANCHES.some(b => b.slug === v));
const date = z.iso.date();
export const orderQuery = z.object({
  status: z.enum([...statuses, 'received', 'collected']).optional(), branch: branchId.optional(),
  from: date.optional(), to: date.optional(),
  q: z.union([orderId, z.string().regex(/^\d{4}$/)]).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25), since: orderId.optional(),
}).strict().refine(v => !v.from || !v.to || v.from <= v.to);
export type OrderQuery = z.infer<typeof orderQuery>;
// Fixed reason codes keep arbitrary names/phones out of immutable audit labels.
export const cancellationReasons = ['customer_request', 'unavailable', 'duplicate', 'branch_closed'] as const;
export const statusBody = z.object({ to: z.enum(statuses), expected: z.enum(statuses),
  recordPayment: z.boolean().optional(), reason: z.enum(cancellationReasons).optional(),
}).strict().refine(v => v.to !== 'cancelled' || Boolean(v.reason));
export type StatusInput = z.infer<typeof statusBody>;
export type OrderSummary = { id: string; orderNumber: number | null; branchId: BranchId; status: OrderStatus; paymentMethod: PaymentMethod;
  paidAt: string | null; totalMinor: number; currency: 'QAR'; createdAt: string; name: string; phone: string; plate: string;
  printCount: number; printedAt: string | null };
export type OrderDetailData = OrderSummary & { customer: { name: string; phone: string; plate: string; colour: string; car: string; instructions: string };
  snapshot: Omit<OrderSnapshot, 'customer'> & { version: number; menuRevision: number };
  history: { at: string; from: OrderStatus; to: OrderStatus; reason: string | null }[]; contactRevealed: boolean;
  amendedAt: string | null; originalTotalMinor: number;
  currentLines: { id: string; name: string; nameAr: string; quantity: number; unitMinor: number; note: string; voided: boolean; compliment: boolean; selection: OrderSnapshot['lines'][number]['selection']; categoryName: string; dishId: string; discount: { mode: 'percent'; bp: number } | { mode: 'amount'; amountMinor: number } | null }[];
  discounts: { scope: 'line' | 'order'; lineId: string | null; amountMinor: number }[];
  edits: { kind: string; lineId: string | null; reasonCode: string; note: string | null }[];
  owedBackMinor: number; };
