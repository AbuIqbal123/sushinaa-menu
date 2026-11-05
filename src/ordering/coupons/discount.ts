import { CouponError, isCouponKind, type CouponKind } from './types';

export type CouponOffer = { kind: CouponKind; value: number };

export function couponOffer(input: { kind: string; value: number }): CouponOffer {
  if (!isCouponKind(input.kind) || !Number.isInteger(input.value)) throw new CouponError('INVALID_VALUE');
  if (input.kind === 'percent' && (input.value < 1 || input.value > 99)) throw new CouponError('INVALID_VALUE');
  if (input.kind === 'amount' && input.value < 1) throw new CouponError('INVALID_VALUE');
  return { kind: input.kind, value: input.value };
}

/** Half up. 1% of 150 minor is 2, not 1. */
export function applyOrderDiscount(subtotalMinor: number, offer: { kind: CouponKind; value: number }) {
  const checked = couponOffer(offer);
  if (!Number.isInteger(subtotalMinor) || subtotalMinor < 0) throw new CouponError('INVALID_VALUE');
  const discountMinor = checked.kind === 'percent'
    ? Math.floor((subtotalMinor * checked.value + 50) / 100)
    : checked.value;
  const totalMinor = subtotalMinor - discountMinor;
  if (discountMinor <= 0 || totalMinor <= 0) throw new CouponError('NON_POSITIVE');
  return { discountMinor, totalMinor };
}
