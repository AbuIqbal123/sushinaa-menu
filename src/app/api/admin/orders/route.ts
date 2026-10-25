import { orderQuery } from '@/ordering/contracts';
import { listOrders } from '@/ordering/orders';
import { requireStaff, reply, failure } from '@/ordering/http';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const staff = await requireStaff(undefined, 'orders');
    return reply(await listOrders(staff.branchScope, orderQuery.parse(Object.fromEntries(new URL(request.url).searchParams))));
  }
  catch (error) { return failure(error); }
}
