import { auditContext } from '@/cms/audit';
import { orderId } from '@/ordering/contracts';
import { applyOrderEdit } from '@/ordering/order-edits';
import { rateAllowed } from '@/ordering/rate-limit';
import { requireStaff, reply, failure, jsonBody, OrderError } from '@/ordering/http';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const staff = await requireStaff(request, 'orders');
    const ctx = auditContext(request, staff.username);
    if (!await rateAllowed('staff', ctx.ip)) throw new OrderError('RATE_LIMIT', 429);
    return reply(await applyOrderEdit(staff.branchScope, orderId.parse((await params).id), await jsonBody(request), ctx, staff.role));
  } catch (error) { return failure(error); }
}
