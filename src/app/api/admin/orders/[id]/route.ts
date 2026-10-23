import { z } from 'zod';
import { adminName } from '@/cms/auth';
import { auditContext } from '@/cms/audit';
import { orderId } from '@/ordering/contracts';
import { detailOrder } from '@/ordering/orders';
import { adminAccess, reply, failure } from '@/ordering/http';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await adminAccess();
    const query = z.object({ contact: z.literal('1').optional() }).strict().parse(Object.fromEntries(new URL(request.url).searchParams));
    return reply(await detailOrder(orderId.parse((await params).id), query.contact === '1', auditContext(request, adminName())));
  } catch (error) { return failure(error); }
}
