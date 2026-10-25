'use client';
import { useEffect, useState } from 'react';
import { BRANCHES, type BranchId } from '@/branches/branches';
import { useLocale } from '@/i18n/locale';

type StaffRow = { id: string; username: string; role: string; branchId: string | null; disabled: boolean };

export function StaffPanel() {
  const { lang } = useLocale();
  const text = (en: string, ar: string) => (lang === 'ar' ? ar : en);
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

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    const response = await fetch('/api/admin/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, role, branchId: role === 'admin' ? null : branchId }),
    });
    if (!response.ok) { setError('save'); return; }
    setUsername('');
    setPassword('');
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
    await load().catch(() => setError('load'));
    return true;
  }

  return (
    <section className="admin-card staff-users">
      {/* TODO(ar): confirm the staff-account labels with the restaurant. */}
      <h2>{text('Staff', 'الموظفون')}</h2>
      {error && <p role="alert">{text('Could not update staff.', 'تعذّر تحديث الموظفين.')}</p>}
      <ul>
        {rows.map((row) => (
          <li key={row.id}>
            <span>{row.username}</span>
            <span>{row.role === 'admin' ? text('Admin', 'مدير') : text('Branch staff', 'موظف الفرع')}</span>
            <span>{row.branchId ?? text('All branches', 'كل الفروع')}</span>
            <button type="button" onClick={() => void change(row.id, { disabled: !row.disabled })}>
              {row.disabled ? text('Enable', 'تفعيل') : text('Disable', 'إيقاف')}
            </button>
            <button type="button" onClick={() => { setEditing(row.id); setEditRole(row.role === 'admin' ? 'admin' : 'branch_staff'); setEditBranch((row.branchId as BranchId | null) ?? 'down-town'); }}>
              {text('Change role and branch', 'تغيير الدور والفرع')}
            </button>
            <button type="button" onClick={() => { setResetting(row.id); setNextPassword(''); }}>
              {text('Reset password', 'إعادة تعيين كلمة المرور')}
            </button>
            {editing === row.id && (
              <form onSubmit={(event) => { event.preventDefault(); void change(row.id, { role: editRole, branchId: editRole === 'admin' ? null : editBranch }).then((ok) => { if (ok) setEditing(null); }); }}>
                <label>{text('Role', 'الدور')}
                  <select aria-label={text('Change role', 'تغيير الدور')} value={editRole} onChange={(event) => setEditRole(event.target.value as typeof editRole)}>
                    <option value="branch_staff">{text('Branch staff', 'موظف الفرع')}</option>
                    <option value="admin">{text('Admin', 'مدير')}</option>
                  </select>
                </label>
                {editRole === 'branch_staff' && (
                  <label>{text('Branch', 'الفرع')}
                    <select aria-label={text('Change branch', 'تغيير الفرع')} value={editBranch} onChange={(event) => setEditBranch(event.target.value as BranchId)}>
                      {BRANCHES.map((branch) => <option key={branch.slug} value={branch.slug}>{lang === 'ar' ? branch.nameAr : branch.name}</option>)}
                    </select>
                  </label>
                )}
                <button type="submit">{text('Save role and branch', 'حفظ الدور والفرع')}</button>
              </form>
            )}
            {resetting === row.id && (
              <form onSubmit={(event) => { event.preventDefault(); void change(row.id, { password: nextPassword }).then((ok) => { if (!ok) return; setResetting(null); setNextPassword(''); }); }}>
                <label>{text('New password', 'كلمة المرور الجديدة')}<input type="password" minLength={8} value={nextPassword} onChange={(event) => setNextPassword(event.target.value)} required /></label>
                <button type="submit">{text('Save password', 'حفظ كلمة المرور')}</button>
              </form>
            )}
          </li>
        ))}
      </ul>
      <form onSubmit={(event) => void create(event)}>
        <label>{text('Username', 'اسم المستخدم')}<input value={username} onChange={(event) => setUsername(event.target.value)} required /></label>
        <label>{text('Password', 'كلمة المرور')}<input type="password" value={password} minLength={8} onChange={(event) => setPassword(event.target.value)} required /></label>
        <label>{text('Role', 'الدور')}
          <select value={role} onChange={(event) => setRole(event.target.value as typeof role)}>
            <option value="branch_staff">{text('Branch staff', 'موظف الفرع')}</option>
            <option value="admin">{text('Admin', 'مدير')}</option>
          </select>
        </label>
        {role === 'branch_staff' && (
          <label>{text('Branch', 'الفرع')}
            <select value={branchId} onChange={(event) => setBranchId(event.target.value as BranchId)}>
              {BRANCHES.map((branch) => <option key={branch.slug} value={branch.slug}>{lang === 'ar' ? branch.nameAr : branch.name}</option>)}
            </select>
          </label>
        )}
        <button className="primary" type="submit">{text('Add staff', 'إضافة موظف')}</button>
      </form>
    </section>
  );
}
