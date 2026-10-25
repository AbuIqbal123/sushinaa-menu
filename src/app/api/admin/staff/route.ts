import { z } from 'zod';
import { auditContext } from '@/cms/audit';
import { createStaff, listStaff } from '@/cms/staff';
import { branchId } from '@/ordering/contracts';
import { requireStaff, reply, failure, jsonBody } from '@/ordering/http';

export const dynamic = 'force-dynamic';

const createBody = z.object({
  username: z.string().trim().min(1).max(64).regex(/^[a-zA-Z0-9._-]+$/),
  password: z.string().min(8).max(200),
  role: z.enum(['admin', 'branch_staff']),
  branchId: branchId.nullable(),
}).strict().refine((value) => value.role === 'admin' ? value.branchId === null : Boolean(value.branchId));

export async function GET() {
  try {
    await requireStaff(undefined, 'users');
    return reply(await listStaff());
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    const staff = await requireStaff(request, 'users');
    const input = createBody.parse(await jsonBody(request));
    return reply(await createStaff(staff, input, auditContext(request, staff.username)), 201);
  } catch (error) { return failure(error); }
}
