import { z } from 'zod';
import { databaseUrl } from '@/cms/db';
import { generateCode } from '@/ordering/coupons/code';
import { createCoupon, listCoupons } from '@/ordering/coupons/repository';
import { CouponError, type CouponKind } from '@/ordering/coupons/types';
import { assertOrderDatabaseAllowed } from '@/ordering/guard';
import { OrderError, failure, jsonBody, reply, requireStaff } from '@/ordering/http';

export const dynamic = 'force-dynamic';

const generateBody = z.object({ generate: z.literal(true) }).strict();
const createBody = z.object({
  code: z.string().trim().min(1).max(32),
  kind: z.enum(['percent', 'amount']),
  value: z.string().trim().min(1).max(12),
  expiresAt: z.string().trim().min(1).max(40),
}).strict();
const postBody = z.union([generateBody, createBody]);

function storedValue(kind: CouponKind, raw: string): number {
  if (kind === 'percent') {
    if (!/^\d{1,2}$/.test(raw)) throw new CouponError('INVALID_VALUE');
    return Number(raw);
  }
  const match = /^(\d{1,6})(?:\.(\d{1,2}))?$/.exec(raw);
  if (!match) throw new CouponError('INVALID_VALUE');
  const minor = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  if (!Number.isSafeInteger(minor) || minor < 1) throw new CouponError('INVALID_VALUE');
  return minor;
}

function asHttp(error: unknown) {
  if (error instanceof CouponError) {
    const status = error.code === 'NOT_FOUND' ? 404 : error.code === 'CONFLICT' ? 409 : 400;
    return failure(new OrderError(error.code, status));
  }
  return failure(error);
}

export async function GET() {
  try {
    assertOrderDatabaseAllowed(databaseUrl);
    await requireStaff(undefined, 'users');
    return reply(await listCoupons());
  } catch (error) { return asHttp(error); }
}

export async function POST(request: Request) {
  try {
    assertOrderDatabaseAllowed(databaseUrl);
    await requireStaff(request, 'users');
    const body = postBody.parse(await jsonBody(request));
    if ('generate' in body) return reply({ code: generateCode() });
    return reply(await createCoupon({
      code: body.code,
      kind: body.kind,
      value: storedValue(body.kind, body.value),
      expiresAt: body.expiresAt,
    }), 201);
  } catch (error) { return asHttp(error); }
}
