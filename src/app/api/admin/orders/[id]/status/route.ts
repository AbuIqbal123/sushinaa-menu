import { auditContext } from '@/cms/audit';
import { orderId, statusBody } from '@/ordering/contracts';
import { transitionOrder } from '@/ordering/orders';
import { rateAllowed } from '@/ordering/rate-limit';
import { requireStaff, reply, failure, jsonBody, OrderError } from '@/ordering/http';
export const dynamic = 'force-dynamic';
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const staff = await requireStaff(request, 'orders');
    const ctx = auditContext(request, staff.username);
    if (!await rateAllowed('staff', ctx.ip)) throw new OrderError('RATE_LIMIT',429);
    await transitionOrder(staff.branchScope, orderId.parse((await params).id), statusBody.parse(await jsonBody(request)), ctx);
    return reply({ ok: true });
  } catch (error) { return failure(error); }
}
