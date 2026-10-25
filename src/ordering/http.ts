import { ZodError } from 'zod';
import { auditContext, auditInsert } from '@/cms/audit';
import { currentStaff, sameOrigin, type StaffPrincipal } from '@/cms/auth';
import { allows, type Permission } from '@/cms/permissions';
import { assertPaymentProviderAllowed } from '@/cms/env-guard';
import { db, databaseUrl } from '@/cms/db';
import { assertOrderDatabaseAllowed, OrderingUnavailable } from './guard';
import { CheckoutError } from './checkout/validation';
export class OrderError extends Error {
  constructor(public code: string, public status: number) { super(code); }
}
export const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
export function failure(error: unknown) {
  if (error instanceof OrderError) return reply({ code: error.code }, error.status);
  if (error instanceof OrderingUnavailable) return reply({ code: 'ORDERING_UNAVAILABLE' }, 503);
  if (error instanceof CheckoutError) return reply({ code: error.code }, error.code === 'LIMIT' ? 429 : 409);
  if (error instanceof ZodError || error instanceof SyntaxError) return reply({ code: 'INVALID' }, 400);
  return reply({ code: 'TEMPORARILY_UNAVAILABLE' }, 503);
}
export function provider() {
  assertOrderDatabaseAllowed(databaseUrl);
  assertPaymentProviderAllowed();
  const p = process.env.PAYMENT_PROVIDER || (process.env.VERCEL_ENV === 'production' ? 'counter' : 'mock');
  if (p !== 'mock' && p !== 'counter') throw new OrderingUnavailable();
  return p;
}
export async function requireStaff(request: Request | undefined, permission: Permission): Promise<StaffPrincipal> {
  const user = await currentStaff();
  if (!user) throw new OrderError('UNAUTHENTICATED', 401);
  if (request) writeAccess(request);
  if (!allows(user.role, permission)) {
    if (permission === 'users' && request) {
      await db.execute(auditInsert(auditContext(request, user.username), {
        action: 'user.change_denied', entityType: 'user', entityId: user.userId,
      }));
    }
    throw new OrderError('FORBIDDEN', 403);
  }
  if (permission === 'orders') assertOrderDatabaseAllowed(databaseUrl);
  return user;
}
export function writeAccess(request: Request) {
  if (!sameOrigin(request)) throw new OrderError('FORBIDDEN', 403);
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new OrderError('INVALID', 415);
}
export async function jsonBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new OrderError('INVALID', 400);
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const next = await reader.read(); if (next.done) break;
    size += next.value.length;
    if (size > 65536) { await reader.cancel(); throw new OrderError('INVALID', 413); }
    chunks.push(next.value);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}
