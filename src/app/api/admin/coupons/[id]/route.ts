import { z } from 'zod';
import { databaseUrl } from '@/cms/db';
import { disableCoupon } from '@/ordering/coupons/repository';
import { CouponError } from '@/ordering/coupons/types';
import { assertOrderDatabaseAllowed } from '@/ordering/guard';
import { OrderError, failure, jsonBody, reply, requireStaff } from '@/ordering/http';

export const dynamic = 'force-dynamic';

const disableBody = z.object({}).strict();

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
    disableBody.parse(await jsonBody(request));
    return reply(await disableCoupon((await params).id));
  } catch (error) { return asHttp(error); }
}
