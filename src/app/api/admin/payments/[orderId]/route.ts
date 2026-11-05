import { paymentDetail } from '@/ordering/ledger';
import { failure, OrderError, reply, requireStaff } from '@/ordering/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: { params: Promise<{ orderId: string }> }) {
  try {
    const staff = await requireStaff(undefined, 'orders');
    if (staff.role !== 'admin') return reply({ code: 'FORBIDDEN' }, 403);
    const { orderId } = await context.params;
    if (!orderId || !/^SU-[0-9a-f-]{36}$/.test(orderId)) throw new OrderError('NOT_FOUND', 404);
    const detail = await paymentDetail(orderId);
    if (!detail) throw new OrderError('NOT_FOUND', 404);
    return reply(detail);
  } catch (error) {
    return failure(error);
  }
}
