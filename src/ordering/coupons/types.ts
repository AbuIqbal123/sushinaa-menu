export const COUPON_KINDS = ['percent', 'amount'] as const;
export type CouponKind = (typeof COUPON_KINDS)[number];

export const COUPON_STATUSES = ['available', 'held', 'redeemed', 'disabled'] as const;
export type CouponStatus = (typeof COUPON_STATUSES)[number];

export const COUPON_ERRORS = [
  'INVALID_CODE',
  'INVALID_VALUE',
  'EXPIRES_REQUIRED',
  'NOT_FOUND',
  'UNAVAILABLE',
  'EXPIRED',
  'NON_POSITIVE',
  'CONFLICT',
] as const;
export type CouponErrorCode = (typeof COUPON_ERRORS)[number];

export class CouponError extends Error {
  constructor(public code: CouponErrorCode) {
    super(code);
  }
}

export type Coupon = {
  id: string;
  code: string;
  kind: CouponKind;
  value: number;
  expiresAt: string;
  status: CouponStatus;
  heldOrderId: string | null;
  heldAt: string | null;
  redeemedOrderId: string | null;
  redeemedAt: string | null;
  /** Kitchen order number when held/redeemed; null if unknown or unused. */
  orderNumber: number | null;
  disabledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CouponSnapshot = {
  code: string;
  kind: CouponKind;
  value: number;
  discountMinor: number;
};

export type CreateCouponInput = {
  code: string;
  kind: CouponKind;
  value: number;
  expiresAt: string;
};

export function isCouponKind(value: string): value is CouponKind {
  return (COUPON_KINDS as readonly string[]).includes(value);
}

export function isCouponStatus(value: string): value is CouponStatus {
  return (COUPON_STATUSES as readonly string[]).includes(value);
}
