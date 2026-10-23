import { orderQuery } from '@/ordering/contracts';
import { listOrders } from '@/ordering/orders';
import { adminAccess, reply, failure } from '@/ordering/http';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try { await adminAccess(); return reply(await listOrders(orderQuery.parse(Object.fromEntries(new URL(request.url).searchParams)))); }
  catch (error) { return failure(error); }
}
