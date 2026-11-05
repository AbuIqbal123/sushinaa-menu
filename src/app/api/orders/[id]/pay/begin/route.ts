import { beginHostedCheckout } from '@/ordering/checkout/begin-payment';
import { failure, OrderError, reply, writeAccess } from '@/ordering/http';
import { orderSession } from '@/ordering/session';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  language: z.enum(['en', 'ar']).optional(),
}).strict();

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    writeAccess(request);
    const { id } = await context.params;
    if (!id || !/^SU-[0-9a-f-]{36}$/.test(id)) throw new OrderError('NOT_FOUND', 404);
    const session = await orderSession();
    const parsed = bodySchema.parse(await request.json().catch(() => ({})));
    const launch = await beginHostedCheckout(id, session, parsed.language ?? 'en');
    return reply(launch);
  } catch (error) {
    return failure(error);
  }
}
