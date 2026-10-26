'use client';
import { useEffect, useState } from 'react';
import { BRANCHES, type BranchId } from '@/branches/branches';
import { useLocale } from '@/i18n/locale';
import { useNotify } from './Notices';

type StaffRow = { id: string; username: string; role: string; branchId: string | null; disabled: boolean };

export function StaffPanel() {
  const { lang } = useLocale();
  const text = (en: string, ar: string) => (lang === 'ar' ? ar : en);
  const notify = useNotify();
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [error, setError] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'branch_staff'>('branch_staff');
  const [branchId, setBranchId] = useState<BranchId>('down-town');
  const [editing, setEditing] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<'admin' | 'branch_staff'>('branch_staff');
  const [editBranch, setEditBranch] = useState<BranchId>('down-town');
  const [resetting, setResetting] = useState<string | null>(null);
  const [nextPassword, setNextPassword] = useState('');

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

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const data = new FormData(event.currentTarget);
    const nextUsername = String(data.get('username') ?? '').trim();
    const nextPassword = String(data.get('password') ?? '');
    const nextRole = String(data.get('role') ?? role) === 'admin' ? 'admin' : 'branch_staff';
    const nextBranch = String(data.get('branchId') ?? branchId) as BranchId;
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
    event.currentTarget.reset();
    notify({ tone: 'ok', text: text('User added', 'تمت إضافة المستخدم') });
    await load().catch(() => setError('load'));
  }

  async function change(id: string, body: Record<string, unknown>) {
    setError('');
    const response = await fetch(`/api/admin/staff/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) { setError('save'); return false; }
    notify({ tone: 'ok', text: text('User updated', 'تم تحديث المستخدم') });
    await load().catch(() => setError('load'));
    return true;
  }

  const branchName = (id: string | null) => {
    if (!id) return text('All branches', 'كل الفروع');
    const branch = BRANCHES.find((item) => item.slug === id);
    return branch ? (lang === 'ar' ? branch.nameAr : branch.name) : id;
  };

  return (
    <div className="users-page">
      <form className="users-create" onSubmit={(event) => void create(event)}>
        <h2>{text('New user', 'مستخدم جديد')}</h2>
        <label>{text('Username', 'اسم المستخدم')}<input name="username" value={username} autoComplete="off" onChange={(event) => setUsername(event.target.value)} required /></label>
        <label>{text('Password', 'كلمة المرور')}<input name="password" type="password" value={password} minLength={8} autoComplete="new-password" onChange={(event) => setPassword(event.target.value)} required /></label>
        <label>{text('Role', 'الدور')}
          <select name="role" value={role} onChange={(event) => setRole(event.target.value as typeof role)}>
            <option value="branch_staff">{text('Branch staff', 'موظف الفرع')}</option>
            <option value="admin">{text('Admin', 'مدير')}</option>
          </select>
        </label>
        <label>{text('Branch', 'الفرع')}
          <select name="branchId" value={branchId} disabled={role === 'admin'} onChange={(event) => setBranchId(event.target.value as BranchId)}>
            {BRANCHES.map((branch) => <option key={branch.slug} value={branch.slug}>{lang === 'ar' ? branch.nameAr : branch.name}</option>)}
          </select>
        </label>
        <button className="primary" type="submit">{text('Add user', 'إضافة مستخدم')}</button>
      </form>
      <section className="users-list">
        {error && <p role="alert">{error === 'conflict' ? text('That username is already in use.', 'اسم المستخدم مستخدم بالفعل.') : text('Could not update staff.', 'تعذّر تحديث الموظفين.')}</p>}
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
                  <button type="button" onClick={() => void change(row.id, { disabled: !row.disabled })}>
                    {row.disabled ? text('Enable', 'تفعيل') : text('Disable', 'إيقاف')}
                  </button>
                  <button type="button" onClick={() => { setEditing(editing === row.id ? null : row.id); setResetting(null); setEditRole(row.role === 'admin' ? 'admin' : 'branch_staff'); setEditBranch((row.branchId as BranchId | null) ?? 'down-town'); }}>
                    {text('Role', 'الدور')}
                  </button>
                  <button type="button" onClick={() => { setResetting(resetting === row.id ? null : row.id); setEditing(null); setNextPassword(''); }}>
                    {text('Password', 'كلمة المرور')}
                  </button>
                  {editing === row.id && (
                    <form onSubmit={(event) => { event.preventDefault(); void change(row.id, { role: editRole, branchId: editRole === 'admin' ? null : editBranch }).then((ok) => { if (ok) setEditing(null); }); }}>
                      <select aria-label={text('Change role', 'تغيير الدور')} value={editRole} onChange={(event) => setEditRole(event.target.value as typeof editRole)}>
                        <option value="branch_staff">{text('Branch staff', 'موظف الفرع')}</option>
                        <option value="admin">{text('Admin', 'مدير')}</option>
                      </select>
                      {editRole === 'branch_staff' && (
                        <select aria-label={text('Change branch', 'تغيير الفرع')} value={editBranch} onChange={(event) => setEditBranch(event.target.value as BranchId)}>
                          {BRANCHES.map((branch) => <option key={branch.slug} value={branch.slug}>{lang === 'ar' ? branch.nameAr : branch.name}</option>)}
                        </select>
                      )}
                      <button type="submit">{text('Save', 'حفظ')}</button>
                    </form>
                  )}
                  {resetting === row.id && (
                    <form onSubmit={(event) => { event.preventDefault(); void change(row.id, { password: nextPassword }).then((ok) => { if (!ok) return; setResetting(null); setNextPassword(''); }); }}>
                      <input type="password" aria-label={text('New password', 'كلمة المرور الجديدة')} minLength={8} value={nextPassword} onChange={(event) => setNextPassword(event.target.value)} required />
                      <button type="submit">{text('Save', 'حفظ')}</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
