import { activeStatuses, terminalStatuses, type OrderStatus, type PaymentMethod } from '@/ordering/status';

/** Where staff should land when opening the order linked to a coupon. */
export type CouponOrderOpen =
  | { section: 'orders'; view: 'active' | 'history'; orderId: string }
  | { section: 'payments'; orderId: string };

export type CouponLinkedOrder = {
  orderId: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paidAt: string | null;
};

/**
 * Coupon status is not the kitchen board. Online codes redeem on payment settle
 * while the order is still `paid` / cooking — that belongs on Orders, not History.
 * Unpaid Sadad/mock holds are not kitchen-visible; open Payments instead.
 */
export function couponOrderOpen(link: CouponLinkedOrder | null): CouponOrderOpen | null {
  if (!link) return null;
  const kitchenVisible = link.paymentMethod === 'pay_at_pickup' || link.paidAt != null;
  if (!kitchenVisible) return { section: 'payments', orderId: link.orderId };
  if ((terminalStatuses as readonly string[]).includes(link.status)) {
    return { section: 'orders', view: 'history', orderId: link.orderId };
  }
  if ((activeStatuses as readonly string[]).includes(link.status)) {
    return { section: 'orders', view: 'active', orderId: link.orderId };
  }
  return null;
}
