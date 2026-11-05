import type { MenuData } from '@/cms/schema';
import { publicMenu } from '@/cms/schema';
import { configuredBranches } from '@/branches/branches';
import { branchStatus, qatarClock } from '@/branches/hours';
import { unitPrice } from '@/ordering/price';
import { CouponError, type CouponErrorCode, type CouponSnapshot } from '@/ordering/coupons/types';
import {
  CheckoutError,
  type CheckoutInput,
  validCheckoutSelection,
} from './validation';

const COUPON_CHECKOUT_CODE = {
  INVALID_CODE: 'INVALID_CODE',
  INVALID_VALUE: 'UNAVAILABLE',
  EXPIRES_REQUIRED: 'UNAVAILABLE',
  NOT_FOUND: 'NOT_FOUND',
  UNAVAILABLE: 'UNAVAILABLE',
  EXPIRED: 'EXPIRED',
  NON_POSITIVE: 'NON_POSITIVE',
  CONFLICT: 'CONFLICT',
} as const satisfies Record<CouponErrorCode, CheckoutError['code']>;

export function couponCheckoutError(error: CouponError) {
  return new CheckoutError(COUPON_CHECKOUT_CODE[error.code]);
}

function quoteMenu(input: CheckoutInput, menu: MenuData, now = new Date(), options?: { allowClosed?: boolean }) {
  const branch = configuredBranches(menu.branches).find(b => b.slug === input.branchId)!;
  if (!options?.allowClosed && !branchStatus(branch.hours, qatarClock(now)).open) throw new CheckoutError('CLOSED');
  if (input.lines.reduce((n, line) => n + line.quantity, 0) > 100) throw new CheckoutError('LIMIT');
  const available = publicMenu(menu).dishes;
  const lines = input.lines.map(line => {
    const dish = available.find(d => d.id === line.dishId);
    if (!dish) throw new CheckoutError('UNAVAILABLE');
    if (!validCheckoutSelection(dish, line.selection)) throw new CheckoutError('OPTIONS');
    const unitMinor = Math.round(unitPrice(dish, line.selection) * 100);
    if (unitMinor !== line.expectedUnitMinor) throw new CheckoutError('PRICE_CHANGED');
    const category = menu.categories.find((item) => item.id === dish.section);
    return { dishId: dish.id, name: dish.name, nameAr: dish.nameAr, kind: dish.kind, freeDips: dish.freeDips, extras: dish.extras,
      categoryId: dish.section, categoryName: category?.name ?? 'Items', categoryNameAr: category?.nameAr ?? '', categoryOrder: category?.order ?? 0,
      selection: line.selection, quantity: line.quantity, note: line.note, unitMinor, totalMinor: unitMinor * line.quantity };
  });
  return { branchId: branch.slug, branchName: branch.name, customer: input.customer, collection: 'car' as const, lines,
    totalMinor: lines.reduce((n, line) => n + line.totalMinor, 0), currency: 'QAR' as const };
}

export async function quoteOrder(input: CheckoutInput, menu: MenuData, now = new Date(), options?: { allowClosed?: boolean }): Promise<ReturnType<typeof quoteMenu> & { coupon?: CouponSnapshot }> {
  const order = quoteMenu(input, menu, now, options);
  if (!input.couponCode) return order;
  // Load the coupon table only when a code is present. A static import would capture CMS_DATABASE_URL before tests point it at a temporary file.
  const { previewCoupon } = await import('@/ordering/coupons/repository');
  try {
    const preview = await previewCoupon(input.couponCode, order.totalMinor, now);
    return { ...order, totalMinor: preview.totalMinor, coupon: preview.snapshot };
  } catch (error) {
    if (error instanceof CouponError) throw couponCheckoutError(error);
    throw error;
  }
}

export type OrderSnapshot = Awaited<ReturnType<typeof quoteOrder>>;
