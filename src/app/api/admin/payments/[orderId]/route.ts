import { auditContext, auditInsert } from '@/cms/audit';
import { db } from '@/cms/db';
import { paymentDetail } from '@/ordering/ledger';
import { failure, OrderError, reply, requireStaff } from '@/ordering/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ orderId: string }> }) {
  try {
    const staff = await requireStaff(undefined, 'orders');
    if (staff.role !== 'admin') return reply({ code: 'FORBIDDEN' }, 403);
    const { orderId } = await context.params;
    if (!orderId || !/^SU-[0-9a-f-]{36}$/.test(orderId)) throw new OrderError('NOT_FOUND', 404);
    const reveal = new URL(request.url).searchParams.get('contact') === '1';
    const detail = await paymentDetail(orderId, reveal);
    if (!detail) throw new OrderError('NOT_FOUND', 404);
    if (reveal) {
      await db.execute(auditInsert(auditContext(request, staff.username), {
        action: 'order.contact_viewed', entityType: 'order', entityId: orderId,
      }));
    }
    return reply(detail);
  } catch (error) {
    return failure(error);
  }
}
