import { z } from 'zod';
import { databaseUrl } from '@/cms/db';
import { disableCoupon, releaseHeldCoupon } from '@/ordering/coupons/repository';
import { CouponError } from '@/ordering/coupons/types';
import { assertOrderDatabaseAllowed } from '@/ordering/guard';
import { OrderError, failure, jsonBody, reply, requireStaff } from '@/ordering/http';

export const dynamic = 'force-dynamic';

const disableBody = z.object({}).strict();
const releaseBody = z.object({ action: z.literal('release') }).strict();
const postBody = z.union([releaseBody, disableBody]);

function asHttp(error: unknown) {
  if (error instanceof CouponError) {
    const status = error.code === 'NOT_FOUND' ? 404 : error.code === 'CONFLICT' ? 409 : 400;
    return failure(new OrderError(error.code, status));
  }
  return failure(error);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertOrderDatabaseAllowed(databaseUrl);
    await requireStaff(request, 'users');
    const body = postBody.parse(await jsonBody(request));
    const id = (await params).id;
    if ('action' in body) return reply(await releaseHeldCoupon(id));
    return reply(await disableCoupon(id));
  } catch (error) { return asHttp(error); }
}
