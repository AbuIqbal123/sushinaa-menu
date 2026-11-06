import { z } from 'zod';
import { auditContext } from '@/cms/audit';
import { readMenu } from '@/cms/repository';
import { isProductionDeployment } from '@/lib/deploy-env';
import { orderId } from '@/ordering/contracts';
import { customerOrder } from '@/ordering/checkout/repository';
import { assertBranchOpen } from '@/ordering/checkout/quote';
import { orderSession } from '@/ordering/session';
import { payMock } from '@/ordering/orders';
import { rateAllowed } from '@/ordering/rate-limit';
import { provider, reply, failure, writeAccess, jsonBody, OrderError } from '@/ordering/http';
export const dynamic = 'force-dynamic';
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (isProductionDeployment()) return reply({code:'NOT_FOUND'},404);
  try {
    if (provider() !== 'mock') return reply({code:'NOT_FOUND'},404);
    writeAccess(request); z.object({}).strict().parse(await jsonBody(request));
    if (!await rateAllowed('mock', auditContext(request, null).ip)) throw new OrderError('RATE_LIMIT', 429);
    const session = await orderSession();
    const id = orderId.parse((await params).id);
    const current = await customerOrder(id, session);
    if (current.paymentStatus !== 'paid') {
      const { menu } = await readMenu();
      assertBranchOpen(menu, current.details.branchId);
    }
    return reply(await payMock(id, session));
  } catch (error) { return failure(error); }
}
