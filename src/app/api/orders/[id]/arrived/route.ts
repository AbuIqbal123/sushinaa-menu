import { orderId } from '@/ordering/contracts';
import { markCustomerArrived } from '@/ordering/checkout/repository';
import { orderSession } from '@/ordering/session';
import { provider, reply, failure, writeAccess, jsonBody } from '@/ordering/http';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    provider();
    writeAccess(request);
    z.object({}).strict().parse(await jsonBody(request));
    return reply(await markCustomerArrived(orderId.parse((await params).id), await orderSession()));
  } catch (error) {
    return failure(error);
  }
}
