import { z } from 'zod';
import { auditContext } from '@/cms/audit';
import { orderId } from '@/ordering/contracts';
import { detailOrder } from '@/ordering/orders';
import { requireStaff, reply, failure } from '@/ordering/http';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const staff = await requireStaff(undefined, 'orders');
    const query = z.object({ contact: z.literal('1').optional() }).strict().parse(Object.fromEntries(new URL(request.url).searchParams));
    return reply(await detailOrder(staff.branchScope, orderId.parse((await params).id), query.contact === '1', auditContext(request, staff.username)));
  } catch (error) { return failure(error); }
}
