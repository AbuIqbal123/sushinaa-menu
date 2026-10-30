import { auditContext, auditInsert } from '@/cms/audit';
import { db } from '@/cms/db';
import { orderId } from '@/ordering/contracts';
import { initOrders } from '@/ordering/checkout/repository';
import { requireStaff, reply, failure, OrderError } from '@/ordering/http';
import { KITCHEN_VISIBLE } from '@/ordering/orders';
import { branchClause } from '@/ordering/scope';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const staff = await requireStaff(request, 'orders');
    await initOrders();
    const id = orderId.parse((await params).id);
    const branch = branchClause(staff.branchScope);
    const row = (await db.execute({
      sql: `SELECT id FROM orders WHERE id=? AND ${branch.sql} AND ${KITCHEN_VISIBLE}`,
      args: [id, ...branch.args],
    })).rows[0];
    if (!row) throw new OrderError('NOT_FOUND', 404);
    await db.execute(auditInsert(auditContext(request, staff.username), {
      action: 'order.receipt_printed', entityType: 'order', entityId: id,
    }));
    return reply({ ok: true });
  } catch (error) { return failure(error); }
}
