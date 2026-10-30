import { z } from 'zod';
import { auditContext } from '@/cms/audit';
import { orderId } from '@/ordering/contracts';
import { confirmPrint } from '@/ordering/printing';
import { requireStaff, reply, failure, jsonBody } from '@/ordering/http';

export const dynamic = 'force-dynamic';
const body = z.object({ claimId: z.string().uuid() }).strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const staff = await requireStaff(request, 'orders');
    const { claimId } = body.parse(await jsonBody(request));
    await confirmPrint(staff.branchScope, orderId.parse((await params).id), claimId, auditContext(request, staff.username));
    return reply({ ok: true });
  } catch (error) { return failure(error); }
}
