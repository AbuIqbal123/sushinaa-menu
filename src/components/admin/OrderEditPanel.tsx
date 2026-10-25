'use client';
import { useState } from 'react';
import type { MenuData } from '@/cms/schema';
import { publicMenu } from '@/cms/schema';
import type { Role } from '@/cms/permissions';
import { editReasons, type EditReason } from '@/ordering/edits';
import { defaultSelection } from '@/ordering/price';
import type { OrderDetailData } from '@/ordering/contracts';

type Line = OrderDetailData['currentLines'][number];

export function OrderEditPanel({ id, data, role, menu, onSaved }: {
  id: string;
  data: OrderDetailData;
  role: Role;
  menu: MenuData;
  onSaved: () => Promise<void>;
}) {
  const editable = ['placed', 'paid', 'accepted', 'preparing', 'ready'].includes(data.status);
  const [reasonCode, setReason] = useState<EditReason>('customer_request');
  const [note, setNote] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [total, setTotal] = useState(data.totalMinor);
  const dishes = publicMenu(menu).dishes;
  const reasons: Record<EditReason, string> = {
    customer_request: 'Customer request', wrong_item: 'Wrong item', item_unavailable: 'Item unavailable',
    quality_issue: 'Quality issue', staff_error: 'Staff error', goodwill: 'Goodwill', loyalty: 'Loyalty', other: 'Other',
  };
  async function send(body: Record<string, unknown>) {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/admin/orders/${id}/edits`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, reasonCode, ...(note.trim() ? { note: note.trim() } : {}) }),
      });
      const payload = await response.json() as { code?: string; totalMinor?: number };
      if (!response.ok) {
        setError(payload.code === 'INCREASE_ON_PAID_ORDER' ? 'A paid order cannot be increased.' : payload.code === 'BELOW_ZERO' ? 'That discount is larger than the amount due.' : payload.code === 'FORBIDDEN' ? 'Only an admin can compliment an item.' : 'This edit was rejected.');
        return;
      }
      if (typeof payload.totalMinor === 'number') setTotal(payload.totalMinor);
      await onSaved();
    } catch {
      setError('This edit was rejected.');
    } finally { setBusy(false); }
  }
  if (!editable) return null;
  const money = (minor: number) => `${(minor / 100).toFixed(2)} QAR`;
  return <section className="order-edit">
    <h3>Edit order</h3>
    <p>Total {money(total)}</p>
    {error && <p role="alert" className="staff-error">{error}</p>}
    <label>Reason<select value={reasonCode} onChange={(event) => setReason(event.target.value as EditReason)}>{editReasons.map((reason) => <option key={reason} value={reason}>{reasons[reason]}</option>)}</select></label>
    <label>Note<textarea value={note} maxLength={140} onChange={(event) => setNote(event.target.value)} /></label>
    {note.trim() && <p>{note.trim()}</p>}
    <ul className="order-edit-lines">{data.currentLines.map((line) => <LineEdit key={line.id} line={line} role={role} busy={busy} onSend={send} />)}</ul>
    <label>Order discount
      <DiscountFields busy={busy} onApply={(mode, value) => void send(mode === 'percent' ? { kind: 'order_discount', mode, bp: value * 100 } : { kind: 'order_discount', mode, amountMinor: value })} />
    </label>
    <label>Add item<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search the menu" /></label>
    {query.trim() && <ul>{dishes.filter((dish) => dish.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8).map((dish) => <li key={dish.id}><button type="button" disabled={busy} onClick={() => void send({ kind: 'add_item', dishId: dish.id, selection: defaultSelection(dish), quantity: 1 })}>{dish.name}</button></li>)}</ul>}
  </section>;
}

function LineEdit({ line, role, busy, onSend }: { line: Line; role: Role; busy: boolean; onSend: (body: Record<string, unknown>) => Promise<void> }) {
  const [price, setPrice] = useState((line.unitMinor / 100).toFixed(2));
  const [qty, setQty] = useState(String(line.quantity));
  if (line.voided) return <li><span>Void {line.name}</span></li>;
  return <li>
    <strong>{line.name}</strong>
    <button type="button" disabled={busy} onClick={() => void onSend({ kind: 'line_price', lineId: line.id, unitMinor: Math.round(Number(price) * 100) })}>Change price</button>
    <input aria-label={`Price for ${line.name}`} value={price} onChange={(event) => setPrice(event.target.value)} />
    <button type="button" disabled={busy} onClick={() => void onSend({ kind: 'qty', lineId: line.id, quantity: Number(qty) })}>Change quantity</button>
    <input aria-label={`Quantity for ${line.name}`} value={qty} onChange={(event) => setQty(event.target.value)} />
    <button type="button" disabled={busy} onClick={() => void onSend({ kind: 'modifier', lineId: line.id, selection: line.selection })}>Update modifier</button>
    <button type="button" disabled={busy} onClick={() => void onSend({ kind: 'void', lineId: line.id })}>Void</button>
    {role === 'admin' && <button type="button" disabled={busy} onClick={() => void onSend({ kind: 'compliment', lineId: line.id })}>Compliment</button>}
    <DiscountFields busy={busy} onApply={(mode, value) => void onSend(mode === 'percent' ? { kind: 'line_discount', lineId: line.id, mode, bp: value * 100 } : { kind: 'line_discount', lineId: line.id, mode, amountMinor: value })} />
  </li>;
}

function DiscountFields({ busy, onApply }: { busy: boolean; onApply: (mode: 'percent' | 'amount', value: number) => void }) {
  const [mode, setMode] = useState<'percent' | 'amount'>('percent');
  const [value, setValue] = useState('10');
  return <span>
    <select aria-label="Discount type" value={mode} onChange={(event) => setMode(event.target.value as 'percent' | 'amount')}>
      <option value="percent">Percent</option>
      <option value="amount">Amount</option>
    </select>
    <input aria-label="Discount value" value={value} onChange={(event) => setValue(event.target.value)} />
    <button type="button" disabled={busy} onClick={() => onApply(mode, mode === 'percent' ? Number(value) : Math.round(Number(value) * 100))}>Apply discount</button>
  </span>;
}
