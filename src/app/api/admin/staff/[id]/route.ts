import { z } from 'zod';
import { auditContext } from '@/cms/audit';
import { changeStaff } from '@/cms/staff';
import { branchId } from '@/ordering/contracts';
import { requireStaff, reply, failure, jsonBody } from '@/ordering/http';

export const dynamic = 'force-dynamic';

const changeBody = z.object({
  role: z.enum(['admin', 'branch_staff']).optional(),
  branchId: branchId.nullable().optional(),
  password: z.string().min(8).max(200).optional(),
  disabled: z.boolean().optional(),
}).strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const staff = await requireStaff(request, 'users');
    await changeStaff(staff, (await params).id, changeBody.parse(await jsonBody(request)), auditContext(request, staff.username));
    return reply({ ok: true });
  } catch (error) { return failure(error); }
}
