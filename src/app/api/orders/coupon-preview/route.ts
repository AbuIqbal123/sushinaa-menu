import { z } from 'zod';
import { previewCoupon } from '@/ordering/coupons/repository';
import { CouponError } from '@/ordering/coupons/types';
import { failure, jsonBody, OrderError, reply, writeAccess } from '@/ordering/http';
import { orderSession } from '@/ordering/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const previewBody = z.object({
  code: z.string().trim().min(1).max(32),
  subtotalMinor: z.number().int().min(0),
}).strict();

export async function POST(request: Request) {
  try {
    writeAccess(request);
    if (!await orderSession()) throw new OrderError('SESSION_REQUIRED', 401);
    const parsed = previewBody.parse(await jsonBody(request));
    const preview = await previewCoupon(parsed.code, parsed.subtotalMinor);
    return reply({
      code: preview.snapshot.code,
      discountMinor: preview.discountMinor,
      totalMinor: preview.totalMinor,
    });
  } catch (error) {
    if (error instanceof CouponError) return reply({ code: error.code }, 409);
    return failure(error);
  }
}
