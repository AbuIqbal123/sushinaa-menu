import { z } from 'zod';
import { orderId } from '@/ordering/contracts';
import { claimPrint } from '@/ordering/printing';
import { requireStaff, reply, failure, jsonBody } from '@/ordering/http';

export const dynamic = 'force-dynamic';
const body = z.object({ mode: z.enum(['auto', 'manual', 'reprint']) }).strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const staff = await requireStaff(request, 'orders');
    const { mode } = body.parse(await jsonBody(request));
    return reply(await claimPrint(staff.branchScope, orderId.parse((await params).id), mode));
  } catch (error) { return failure(error); }
}
