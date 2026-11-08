import type { CouponStatus } from './types';

const next: Record<CouponStatus, readonly CouponStatus[]> = {
  available: ['held', 'disabled'],
  held: ['available', 'redeemed'],
  redeemed: [],
  disabled: [],
};

export function canCouponTransition(from: CouponStatus, to: CouponStatus) {
  return next[from].includes(to);
}

export type CouponEdge = { readonly set: string; readonly from: string };

export const releaseHeld: CouponEdge = {
  set: `status='available', held_order_id=NULL, held_at=NULL, updated_at=?`,
  from: `status='held'`,
};

export const redeemHeld: CouponEdge = {
  set: `status='redeemed', redeemed_order_id=?, redeemed_at=?, held_order_id=NULL, held_at=NULL, updated_at=?`,
  from: `status='held'`,
};

export const holdAvailable: CouponEdge = {
  set: `status='held', held_order_id=?, held_at=?, updated_at=?`,
  from: `status='available'`,
};

export const disableAvailable: CouponEdge = {
  set: `status='disabled', disabled_at=?, updated_at=?`,
  from: `status='available'`,
};
