import { adminName } from '@/cms/auth';
import { auditContext } from '@/cms/audit';
import { orderId, statusBody } from '@/ordering/contracts';
import { transitionOrder } from '@/ordering/orders';
import { rateAllowed } from '@/ordering/rate-limit';
import { adminAccess, reply, failure, jsonBody, OrderError } from '@/ordering/http';
export const dynamic = 'force-dynamic';
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await adminAccess(request);
    const ctx = auditContext(request, adminName());
    if (!await rateAllowed('staff', ctx.ip)) throw new OrderError('RATE_LIMIT',429);
    await transitionOrder(orderId.parse((await params).id), statusBody.parse(await jsonBody(request)), ctx);
    return reply({ ok: true });
  } catch (error) { return failure(error); }
}
