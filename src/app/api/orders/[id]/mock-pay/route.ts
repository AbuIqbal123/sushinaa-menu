import { z } from 'zod';
import { auditContext } from '@/cms/audit';
import { orderId } from '@/ordering/contracts';
import { orderSession } from '@/ordering/session';
import { payMock } from '@/ordering/orders';
import { rateAllowed } from '@/ordering/rate-limit';
import { provider, reply, failure, writeAccess, jsonBody, OrderError } from '@/ordering/http';
export const dynamic = 'force-dynamic';
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (process.env.VERCEL_ENV === 'production') return reply({code:'NOT_FOUND'},404);
  try {
    if (provider() !== 'mock') return reply({code:'NOT_FOUND'},404);
    writeAccess(request); z.object({}).strict().parse(await jsonBody(request));
    if (!await rateAllowed('mock', auditContext(request, null).ip)) throw new OrderError('RATE_LIMIT', 429);
    return reply(await payMock(orderId.parse((await params).id), await orderSession()));
  } catch (error) { return failure(error); }
}
