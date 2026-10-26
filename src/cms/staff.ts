import { randomUUID } from 'node:crypto';
import { db, initDb } from '@/cms/db';
import { auditInsert, type AuditContext } from '@/cms/audit';
import { hashPassword } from '@/cms/passwords';
import type { Role } from '@/cms/permissions';
import { OrderError } from '@/ordering/http';
import type { BranchId } from '@/branches/branches';
import type { StaffPrincipal } from '@/cms/auth';

export type StaffChange = {
  role?: Role;
  branchId?: BranchId | null;
  password?: string;
  disabled?: boolean;
};

function deny(actor: StaffPrincipal, ctx: AuditContext) {
  return db.execute(auditInsert(ctx, {
    action: 'user.change_denied',
    entityType: 'user',
    entityId: actor.userId,
  }));
}

export async function listStaff() {
  await initDb();
  const rows = (await db.execute('SELECT id,username,role,branch_id,disabled_at,created_at FROM staff_users ORDER BY username')).rows;
  return rows.map((row) => ({
    id: String(row.id),
    username: String(row.username),
    role: String(row.role),
    branchId: row.branch_id == null ? null : String(row.branch_id),
    disabled: row.disabled_at != null,
  }));
}

export async function createStaff(
  actor: StaffPrincipal,
  input: { username: string; password: string; role: Role; branchId: BranchId | null },
  ctx: AuditContext,
) {
  if (actor.role !== 'admin') {
    await deny(actor, ctx);
    throw new OrderError('FORBIDDEN', 403);
  }
  await initDb();
  const id = `US-${randomUUID()}`;
  const now = new Date().toISOString();
  const passwordHash = await hashPassword(input.password);
  try {
    await db.batch([
      {
        sql: `INSERT INTO staff_users (id,username,password_hash,role,branch_id,auth_version,disabled_at,created_at,updated_at)
          VALUES (?,?,?,?,?,1,NULL,?,?)`,
        args: [id, input.username, passwordHash, input.role, input.branchId, now, now],
      },
      auditInsert(ctx, {
        action: 'user.changed',
        entityType: 'user',
        entityId: id,
        diff: {
          role: { from: null, to: input.role },
          branch: { from: null, to: input.branchId },
        },
      }),
    ], 'write');
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/UNIQUE/i.test(message)) throw new OrderError('CONFLICT', 409);
    throw error;
  }
  return { id };
}

export async function changeStaff(actor: StaffPrincipal, userId: string, input: StaffChange, ctx: AuditContext) {
  if (actor.role !== 'admin') {
    await deny(actor, ctx);
    throw new OrderError('FORBIDDEN', 403);
  }
  await initDb();
  const current = (await db.execute({
    sql: 'SELECT role,branch_id,disabled_at,password_hash FROM staff_users WHERE id=?',
    args: [userId],
  })).rows[0];
  if (!current) throw new OrderError('NOT_FOUND', 404);
  const role = input.role ?? (current.role === 'admin' ? 'admin' : 'branch_staff');
  const branchId = role === 'admin' ? null : input.branchId === undefined ? (current.branch_id == null ? null : String(current.branch_id)) : input.branchId;
  if (role === 'branch_staff' && !branchId) throw new OrderError('INVALID', 400);
  const disabledAt = input.disabled === undefined ? (current.disabled_at == null ? null : String(current.disabled_at)) : input.disabled ? new Date().toISOString() : null;
  const passwordHash = input.password ? await hashPassword(input.password) : null;
  const diff: Record<string, { from: unknown; to: unknown }> = {};
  if (role !== current.role) diff.role = { from: current.role, to: role };
  if (String(branchId ?? '') !== String(current.branch_id ?? '')) diff.branch = { from: current.branch_id ?? null, to: branchId };
  if (input.password) diff.password = { from: 'set', to: 'reset' };
  if ((disabledAt == null) !== (current.disabled_at == null)) diff.disabled = { from: current.disabled_at != null, to: disabledAt != null };
  const now = new Date().toISOString();
  const tx = await db.transaction('write');
  let committed = false;
  try {
    const updated = await tx.execute({
      sql: `UPDATE staff_users SET role=?, branch_id=?, password_hash=COALESCE(?, password_hash), disabled_at=?, auth_version=auth_version+1, updated_at=? WHERE id=?`,
      args: [role, branchId, passwordHash, disabledAt, now, userId],
    });
    if (updated.rowsAffected !== 1) throw new OrderError('NOT_FOUND', 404);
    await tx.execute({ sql: 'DELETE FROM staff_sessions WHERE user_id=?', args: [userId] });
    await tx.execute(auditInsert(ctx, { action: 'user.changed', entityType: 'user', entityId: userId, diff }));
    await tx.commit();
    committed = true;
  } finally {
    if (!committed) await tx.rollback().catch(() => undefined);
    tx.close();
  }
}
