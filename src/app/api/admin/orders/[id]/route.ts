import { orderId } from '@/ordering/contracts';
import { detailOrder } from '@/ordering/orders';
import { requireStaff, reply, failure } from '@/ordering/http';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const staff = await requireStaff(undefined, 'orders');
    return reply(await detailOrder(staff.branchScope, orderId.parse((await params).id)));
  } catch (error) { return failure(error); }
}
