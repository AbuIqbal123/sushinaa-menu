export const statuses = ['placed', 'paid', 'accepted', 'preparing', 'ready', 'completed', 'cancelled', 'refunded'] as const;
export type OrderStatus = typeof statuses[number];
export type PaymentMethod = 'pay_at_pickup' | 'mock';
const next: Record<OrderStatus, readonly OrderStatus[]> = {
  placed: ['accepted', 'cancelled'], paid: ['accepted', 'cancelled'],
  accepted: ['preparing', 'cancelled'], preparing: ['ready', 'cancelled'],
  ready: ['completed', 'cancelled'], cancelled: ['refunded'], completed: [], refunded: [],
};
export function allowedTransitions(status: OrderStatus, paidAt: string | null) {
  return next[status].filter(s => s !== 'refunded' || Boolean(paidAt));
}
export function canTransition(from: OrderStatus, to: OrderStatus, paidAt: string | null) {
  return allowedTransitions(from, paidAt).includes(to);
}
export const staffGroups = {
  received: ['placed', 'paid', 'accepted'], preparing: ['preparing'], ready: ['ready'],
  collected: ['completed'], cancelled: ['cancelled', 'refunded'],
} as const;
export type StaffStatus = keyof typeof staffGroups;
// Arabic labels supplied by the restaurant brief.
export const staffLabels: Record<StaffStatus, { en: string; ar: string }> = {
  received: { en: 'Received', ar: 'تم الاستلام' }, preparing: { en: 'Preparing', ar: 'قيد التحضير' },
  ready: { en: 'Ready', ar: 'جاهز' }, collected: { en: 'Collected', ar: 'تم التسليم' },
  cancelled: { en: 'Cancelled', ar: 'ملغي' },
};
export function staffStatus(status: OrderStatus): StaffStatus {
  return (Object.keys(staffGroups) as StaffStatus[]).find(k => (staffGroups[k] as readonly string[]).includes(status))!;
}
