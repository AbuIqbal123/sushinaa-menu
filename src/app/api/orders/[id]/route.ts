import { customerOrder } from '@/ordering/checkout/repository';
import { orderId } from '@/ordering/contracts';
import { orderSession } from '@/ordering/session';
import { provider, reply, failure } from '@/ordering/http';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { provider(); return reply(await customerOrder(orderId.parse((await params).id), await orderSession())); }
  catch (error) { return failure(error); }
}
