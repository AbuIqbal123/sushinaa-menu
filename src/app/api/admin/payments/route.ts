import { auditContext } from '@/cms/audit';
import { listPayments } from '@/ordering/ledger';
import { failure, reply, requireStaff } from '@/ordering/http';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const querySchema = z.object({
  status: z.string().max(40).optional(),
  branchId: z.string().max(40).optional(),
  from: z.string().max(40).optional(),
  to: z.string().max(40).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
}).strict();

export async function GET(request: Request) {
  try {
    const staff = await requireStaff(undefined, 'orders');
    if (staff.role !== 'admin') return reply({ code: 'FORBIDDEN' }, 403);
    void auditContext;
    const parsed = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    return reply(await listPayments(parsed));
  } catch (error) {
    return failure(error);
  }
}
