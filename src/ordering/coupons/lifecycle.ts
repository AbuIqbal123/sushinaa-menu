import type { CouponStatus } from './types';

/**
 * Coupon status transitions. SQL writers must use these assigns + WHERE status=
 * so the graph stays the single owner.
 */
const next: Record<CouponStatus, readonly CouponStatus[]> = {
  available: ['held', 'disabled'],
  held: ['available', 'redeemed'],
  redeemed: [],
  disabled: [],
};

export function canCouponTransition(from: CouponStatus, to: CouponStatus) {
  return next[from].includes(to);
}

/** SET clause: held → available (release / TTL). Placeholders: updated_at. */
export const RELEASE_ASSIGN =
  `status='available', held_order_id=NULL, held_at=NULL, updated_at=?`;

/** SET clause: held → redeemed. Placeholders: redeemed_order_id, redeemed_at, updated_at. */
export const REDEEM_ASSIGN =
  `status='redeemed', redeemed_order_id=?, redeemed_at=?, held_order_id=NULL, held_at=NULL, updated_at=?`;

/** SET clause: available → held. Placeholders: held_order_id, held_at, updated_at. */
export const HOLD_ASSIGN =
  `status='held', held_order_id=?, held_at=?, updated_at=?`;

/** SET clause: available → disabled. Placeholders: disabled_at, updated_at. */
export const DISABLE_ASSIGN =
  `status='disabled', disabled_at=?, updated_at=?`;

export const FROM_AVAILABLE = `status='available'`;
export const FROM_HELD = `status='held'`;
