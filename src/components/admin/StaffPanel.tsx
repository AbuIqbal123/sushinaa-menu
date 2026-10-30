'use client';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { BRANCHES, type BranchId } from '@/branches/branches';
import { useLocale } from '@/i18n/locale';
import { useModal } from './Fields';
import { useNotify } from './Notices';

type StaffRow = { id: string; username: string; role: string; branchId: string | null; disabled: boolean };
type StaffRole = 'admin' | 'branch_staff';

export function StaffPanel({ creating, onCreating }: { creating: boolean; onCreating: (open: boolean) => void }) {
  const { lang } = useLocale();
  const text = (en: string, ar: string) => (lang === 'ar' ? ar : en);
  const notify = useNotify();
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [error, setError] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<StaffRole>('branch_staff');
  const [branchId, setBranchId] = useState<BranchId>('down-town');
  const [editing, setEditing] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<StaffRole>('branch_staff');
  const [editBranch, setEditBranch] = useState<BranchId>('down-town');
  const [resetting, setResetting] = useState<string | null>(null);
  const [nextPassword, setNextPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const response = await fetch('/api/admin/staff', { cache: 'no-store' });
    if (!response.ok) throw new Error('load');
    setRows(await response.json());
  }
  useEffect(() => {
    let live = true;
    fetch('/api/admin/staff', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('load');
        const body = await response.json() as StaffRow[];
        if (live) setRows(body);
      })
      .catch(() => { if (live) setError('load'); });
    return () => { live = false; };
  }, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    const data = new FormData(event.currentTarget);
    const nextUsername = String(data.get('username') ?? '').trim();
    const nextPassword = String(data.get('password') ?? '');
    const nextRole = String(data.get('role') ?? role) === 'admin' ? 'admin' : 'branch_staff';
    const nextBranch = String(data.get('branchId') ?? branchId) as BranchId;
    try {
      const response = await fetch('/api/admin/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: nextUsername, password: nextPassword, role: nextRole, branchId: nextRole === 'admin' ? null : nextBranch }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(body.code === 'CONFLICT' ? 'conflict' : 'save');
        return;
      }
      setUsername('');
      setPassword('');
      setRole('branch_staff');
      setBranchId('down-town');
      onCreating(false);
      notify({ tone: 'ok', text: text('User added', 'تمت إضافة المستخدم') });
      await load();
    } catch {
      setError('save');
    } finally {
      setBusy(false);
    }
  }

  async function change(id: string, body: Record<string, unknown>) {
    if (busy) return false;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/staff/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) { setError('save'); return false; }
      notify({ tone: 'ok', text: text('User updated', 'تم تحديث المستخدم') });
      await load();
      return true;
    } catch {
      setError('save');
      return false;
    } finally {
      setBusy(false);
    }
  }

  const branchName = (id: string | null) => {
    if (!id) return text('All branches', 'كل الفروع');
    const branch = BRANCHES.find((item) => item.slug === id);
    return branch ? (lang === 'ar' ? branch.nameAr : branch.name) : id;
  };
  const message = error === 'conflict'
    ? text('That username is already in use.', 'اسم المستخدم مستخدم بالفعل.')
    : error === 'load'
      ? text('Could not load staff.', 'تعذّر تحميل الموظفين.')
      : text('Could not update staff.', 'تعذّر تحديث الموظفين.');
  const editingRow = rows.find((row) => row.id === editing) ?? null;
  const resettingRow = rows.find((row) => row.id === resetting) ?? null;

  const closeLabel = text('Close', 'إغلاق');
  return (
    <>
    {error && !creating && !editing && !resetting && <p role="alert" className="staff-error">{message}</p>}
    <section className="users-list">
      <table>
        <thead>
          <tr>
            <th>{text('Username', 'اسم المستخدم')}</th>
            <th>{text('Role', 'الدور')}</th>
            <th>{text('Branch', 'الفرع')}</th>
            <th>{text('Access', 'الوصول')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} data-disabled={row.disabled || undefined}>
              <td>{row.username}</td>
              <td>{row.role === 'admin' ? text('Admin', 'مدير') : text('Branch staff', 'موظف الفرع')}</td>
              <td>{branchName(row.branchId)}</td>
              <td className="users-access">
                <button type="button" className={row.disabled ? undefined : 'danger'} disabled={busy} onClick={() => void change(row.id, { disabled: !row.disabled })}>
                  {row.disabled ? text('Enable', 'تفعيل') : text('Disable', 'إيقاف')}
                </button>
                <button type="button" disabled={busy} onClick={() => { setError(''); setResetting(null); setEditing(row.id); setEditRole(row.role === 'admin' ? 'admin' : 'branch_staff'); setEditBranch((row.branchId as BranchId | null) ?? 'down-town'); }}>
                  {text('Change role', 'تغيير الدور')}
                </button>
                <button type="button" disabled={busy} onClick={() => { setError(''); setEditing(null); setResetting(row.id); setNextPassword(''); }}>
                  {text('Reset password', 'إعادة تعيين كلمة المرور')}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {creating && (
        <UserDialog title={text('Create new user', 'إنشاء مستخدم جديد')} closeLabel={closeLabel} busy={busy} submitLabel={text('Create user', 'إنشاء المستخدم')} error={error ? message : ''} onClose={() => { setError(''); onCreating(false); }} onSubmit={(event) => void create(event)}>
          <label>{text('Username', 'اسم المستخدم')}<input name="username" value={username} autoComplete="off" onChange={(event) => setUsername(event.target.value)} required /></label>
          <label>{text('Password', 'كلمة المرور')}<input name="password" type="password" value={password} minLength={8} autoComplete="new-password" onChange={(event) => setPassword(event.target.value)} required /></label>
          <label>{text('Role', 'الدور')}
            <select name="role" value={role} onChange={(event) => setRole(event.target.value as StaffRole)}>
              <option value="branch_staff">{text('Branch staff', 'موظف الفرع')}</option>
              <option value="admin">{text('Admin', 'مدير')}</option>
            </select>
          </label>
          {role === 'branch_staff' && (
            <label>{text('Branch', 'الفرع')}
              <select name="branchId" value={branchId} onChange={(event) => setBranchId(event.target.value as BranchId)}>
                {BRANCHES.map((branch) => <option key={branch.slug} value={branch.slug}>{lang === 'ar' ? branch.nameAr : branch.name}</option>)}
              </select>
            </label>
          )}
        </UserDialog>
      )}
      {editingRow && (
        <UserDialog title={text('Change role', 'تغيير الدور')} closeLabel={closeLabel} busy={busy} submitLabel={text('Save', 'حفظ')} error={error ? message : ''} onClose={() => { setError(''); setEditing(null); }} onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const nextRole = String(data.get('role') ?? editRole) === 'admin' ? 'admin' : 'branch_staff';
          const nextBranch = String(data.get('branchId') ?? editBranch) as BranchId;
          void change(editingRow.id, { role: nextRole, branchId: nextRole === 'admin' ? null : nextBranch }).then((ok) => { if (ok) setEditing(null); });
        }}>
          <label>{text('Role', 'الدور')}
            <select name="role" aria-label={text('Change role', 'تغيير الدور')} value={editRole} onChange={(event) => setEditRole(event.target.value as StaffRole)}>
              <option value="branch_staff">{text('Branch staff', 'موظف الفرع')}</option>
              <option value="admin">{text('Admin', 'مدير')}</option>
            </select>
          </label>
          {editRole === 'branch_staff' && (
            <label>{text('Branch', 'الفرع')}
              <select name="branchId" aria-label={text('Change branch', 'تغيير الفرع')} value={editBranch} onChange={(event) => setEditBranch(event.target.value as BranchId)}>
                {BRANCHES.map((branch) => <option key={branch.slug} value={branch.slug}>{lang === 'ar' ? branch.nameAr : branch.name}</option>)}
              </select>
            </label>
          )}
        </UserDialog>
      )}
      {resettingRow && (
        <UserDialog title={text('Reset password', 'إعادة تعيين كلمة المرور')} closeLabel={closeLabel} busy={busy} submitLabel={text('Save', 'حفظ')} error={error ? message : ''} onClose={() => { setError(''); setResetting(null); setNextPassword(''); }} onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const passwordValue = String(data.get('password') ?? nextPassword);
          void change(resettingRow.id, { password: passwordValue }).then((ok) => { if (!ok) return; setResetting(null); setNextPassword(''); });
        }}>
          <label>{text('New password', 'كلمة المرور الجديدة')}<input name="password" type="password" aria-label={text('New password', 'كلمة المرور الجديدة')} minLength={8} autoComplete="new-password" value={nextPassword} onChange={(event) => setNextPassword(event.target.value)} required /></label>
        </UserDialog>
      )}
    </section>
    </>
  );
}

function UserDialog({ title, closeLabel, busy, submitLabel, error, onClose, onSubmit, children }: {
  title: string;
  closeLabel: string;
  busy: boolean;
  submitLabel: string;
  error: string;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useModal(ref);
  return (
    <dialog ref={ref} className="users-dialog" aria-labelledby="user-dialog-title" onCancel={(event) => { event.preventDefault(); onClose(); }} onClose={onClose}>
      <form onSubmit={onSubmit}>
        <header className="admin-dialog-head">
          <h2 id="user-dialog-title">{title}</h2>
          <button type="button" disabled={busy} onClick={onClose}>{closeLabel}</button>
        </header>
        <div className="admin-dialog-body">
          {error && <p role="alert" className="staff-error">{error}</p>}
          {children}
        </div>
        <footer className="admin-dialog-foot">
          <button className="primary" type="submit" disabled={busy}>{submitLabel}</button>
        </footer>
      </form>
    </dialog>
  );
}
