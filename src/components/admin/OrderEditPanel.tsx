'use client';
import { useRef, useState } from 'react';
import type { MenuData } from '@/cms/schema';
import { publicMenu } from '@/cms/schema';
import type { Role } from '@/cms/permissions';
import type { Dish, Selection } from '@/catalog/types';
import { useLocale } from '@/i18n/locale';
import { applyEdits, editReasons, type EditReason, type ResolvedEdit, type WorkingLine } from '@/ordering/edits';
import { defaultSelection, preferredPieces, unitPrice } from '@/ordering/price';
import type { OrderDetailData } from '@/ordering/contracts';
import { isPrintable } from '@/ordering/status';
import { useModal } from './Fields';

type Line = OrderDetailData['currentLines'][number];
type SheetKind = 'qty' | 'price' | 'modifier' | 'discount' | 'order_discount' | 'add';

const editable = ['placed', 'paid', 'accepted', 'preparing', 'ready'];

export function OrderEditPanel({ id, data, role, menu, onSaved, onReceipt, onReprint }: {
  id: string;
  data: OrderDetailData;
  role: Role;
  menu: MenuData;
  onSaved: () => Promise<void>;
  onReceipt: () => void;
  onReprint: () => void;
}) {
  const { lang } = useLocale();
  const text = (en: string, ar: string) => lang === 'ar' ? ar : en;
  const reasons = reasonLabels(text);
  const dishes = publicMenu(menu).dishes;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetKind | null>(null);
  const [confirm, setConfirm] = useState<'void' | 'compliment' | null>(null);
  const [reasonCode, setReason] = useState<EditReason>('customer_request');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const line = data.currentLines.find((item) => item.id === selectedId) ?? null;
  const dish = line ? dishes.find((item) => item.id === line.dishId) : undefined;
  const canEdit = editable.includes(data.status);
  const cancelled = data.status === 'cancelled';
  const lineOn = Boolean(line && canEdit && !cancelled && !line.voided);
  const money = (minor: number) => `${(minor / 100).toFixed(2)} ${text('QAR', 'ر.ق')}`;
  const latest = new Map<string, OrderDetailData['edits'][number]>();
  let orderEdit: OrderDetailData['edits'][number] | null = null;
  for (const edit of data.edits) {
    if (edit.lineId) latest.set(edit.lineId, edit);
    else orderEdit = edit;
  }
  const gross = data.currentLines.reduce((sum, item) => sum + (item.voided || item.compliment ? 0 : item.unitMinor * item.quantity), 0);
  const adjusted = data.amendedAt != null || data.discounts.length > 0 || data.currentLines.some((item) => item.voided || item.compliment);

  async function send(body: Record<string, unknown>) {
    if (busy) return false;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/orders/${id}/edits`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, reasonCode, ...(note.trim() ? { note: note.trim() } : {}) }),
      });
      const payload = await response.json() as { code?: string };
      if (!response.ok) {
        setError(payload.code === 'INCREASE_ON_PAID_ORDER' ? text('A paid order cannot be increased.', 'لا يمكن زيادة طلب مدفوع.') : payload.code === 'BELOW_ZERO' ? text('That discount is larger than the amount due.', 'هذا الخصم أكبر من المبلغ المستحق.') : payload.code === 'FORBIDDEN' ? text('Only an admin can compliment an item.', 'فقط المسؤول يمكنه إهداء صنف.') : text('This edit was rejected.', 'تم رفض هذا التعديل.'));
        return false;
      }
      setSheet(null);
      setConfirm(null);
      setNote('');
      await onSaved();
      return true;
    } catch {
      setError(text('This edit was rejected.', 'تم رفض هذا التعديل.'));
      return false;
    } finally { setBusy(false); }
  }

  function open(kind: SheetKind) {
    setError('');
    setSheet(kind);
  }

  return <div className="order-edit">
    <section className="admin-card order-edit-card">
      <h3>{text('Order', 'الطلب')}</h3>
      <ul className="order-edit-lines">
        {data.currentLines.map((item) => {
          const edit = latest.get(item.id);
          const name = lang === 'ar' ? item.nameAr || item.name : item.name;
          const added = item.id.startsWith('A-');
          return <li key={item.id}>
            <button type="button" className="order-edit-line" aria-pressed={item.id === selectedId} onClick={() => setSelectedId(item.id)}>
              <span className={item.voided ? 'order-edit-void' : undefined}>
                <span className="order-edit-name">{name}</span>
                {edit && <small>{reasons[edit.reasonCode as EditReason] || edit.reasonCode}{edit.note ? ` · ${edit.note}` : ''}</small>}
              </span>
              <span className="order-edit-meta">
                {item.voided && <span className="admin-pill off">{text('Void', 'ملغى')}</span>}
                {item.compliment && <span className="admin-pill">{text('Comp', 'هدية')}</span>}
                {added && !item.voided && <span className="admin-pill">{text('Added', 'مضاف')}</span>}
                <span>×{item.quantity}</span>
                <span>{money(item.voided || item.compliment ? 0 : item.unitMinor * item.quantity)}</span>
                <span aria-hidden="true">{lang === 'ar' ? '‹' : '›'}</span>
              </span>
            </button>
          </li>;
        })}
      </ul>
      {orderEdit && <small className="order-edit-note">{reasons[orderEdit.reasonCode as EditReason] || orderEdit.reasonCode}{orderEdit.note ? ` · ${orderEdit.note}` : ''}</small>}
      <div className="order-edit-sum">
        {adjusted && <>
          <p><span>{text('Subtotal', 'المجموع الفرعي')}</span><span>{money(gross)}</span></p>
          <p><span>{text('Discounts & comps', 'الخصومات والهدايا')}</span><span>{money(gross - data.totalMinor)}</span></p>
        </>}
        <p><span>{text('Total', 'الإجمالي')}</span><strong>{money(data.totalMinor)}</strong></p>
      </div>
    </section>
    <div className="admin-savebar order-edit-bar">
      <div className="order-edit-group">
        <button type="button" disabled={!lineOn || busy} onClick={() => open('qty')}>{text('Qty', 'الكمية')}</button>
        <button type="button" disabled={!lineOn || busy} onClick={() => open('price')}>{text('Price', 'السعر')}</button>
        <button type="button" disabled={!lineOn || busy || !dish || choiceGroups(dish, line?.selection ?? {}, lang).length === 0} onClick={() => open('modifier')}>{text('Modifier', 'الخيار')}</button>
        <button type="button" disabled={!lineOn || busy} onClick={() => open('discount')}>{text('Discount', 'خصم')}</button>
        <button type="button" disabled={!lineOn || busy || role !== 'admin'} onClick={() => { setError(''); setConfirm('compliment'); }}>{text('Comp', 'هدية')}</button>
        <button type="button" className="danger" disabled={!lineOn || busy} onClick={() => { setError(''); setConfirm('void'); }}>{text('Void', 'إلغاء الصنف')}</button>
      </div>
      <span className="order-edit-divider" />
      <div className="order-edit-group">
        <button type="button" disabled={!canEdit || cancelled || Boolean(data.paidAt) || busy} onClick={() => open('add')}>{text('Add item', 'إضافة صنف')}</button>
        <button type="button" disabled={!canEdit || cancelled || busy} onClick={() => open('order_discount')}>{text('Order discount', 'خصم الطلب')}</button>
        <button type="button" disabled={busy} onClick={onReceipt}>{text('Receipt', 'الإيصال')}</button>
        <button type="button" disabled={cancelled || busy || !isPrintable(data.status)} onClick={onReprint}>{text('Reprint kitchen', 'إعادة طباعة المطبخ')}</button>
      </div>
      <small>{line ? text(`Selected: ${lang === 'ar' ? line.nameAr || line.name : line.name}`, `المحدد: ${line.nameAr || line.name}`) : text('Select a line to edit it.', 'اختر صنفاً لتعديله.')}</small>
    </div>
    {sheet && <EditSheet
      kind={sheet} line={line} dish={dish} dishes={dishes} data={data} busy={busy} error={error}
      reasonCode={reasonCode} note={note} reasons={reasons} text={text} lang={lang} money={money}
      onReason={setReason} onNote={setNote} onClose={() => { setSheet(null); setError(''); }}
      onApply={(body) => void send(body)}
    />}
    {confirm && line && <ConfirmEdit
      kind={confirm} line={line} data={data} busy={busy} error={error} text={text} money={money}
      onCancel={() => setConfirm(null)}
      onApply={() => void send({ kind: confirm, lineId: line.id })}
    />}
  </div>;
}

function reasonLabels(text: (en: string, ar: string) => string): Record<EditReason, string> {
  return {
    customer_request: text('Customer request', 'طلب العميل'),
    wrong_item: text('Wrong item', 'صنف خاطئ'),
    item_unavailable: text('Item unavailable', 'الصنف غير متوفر'),
    quality_issue: text('Quality issue', 'مشكلة في الجودة'),
    staff_error: text('Staff error', 'خطأ الموظف'),
    goodwill: text('Goodwill', 'مجاملة'),
    loyalty: text('Loyalty', 'ولاء'),
    other: text('Other', 'أخرى'),
  };
}

function asWorking(lines: Line[]): WorkingLine[] {
  return lines.map((line, index) => ({
    ...line,
    categoryNameAr: '',
    categoryOrder: index,
    selection: { ...line.selection },
    discount: line.discount ? { ...line.discount } : null,
  }));
}

function choiceGroups(dish: Dish, sel: Selection, lang: 'en' | 'ar') {
  const n = (en?: string, ar?: string) => (lang === 'ar' ? ar || en || '' : en || '');
  const kind = dish.kind;
  const groups: { key: string; label: string; options: { value: string; label: string }[]; multi?: boolean }[] = [];
  const add = (key: string, label: string, options: { value: string; label: string }[], multi = false) => {
    if (options.length) groups.push({ key, label, options, multi });
  };
  if (kind.type === 'roll') {
    add('protein', n('Protein', 'البروتين'), kind.proteins.map((item) => ({ value: item.id, label: n(item.name, item.nameAr) })));
    const protein = kind.proteins.find((item) => item.id === sel.protein) ?? kind.proteins[0];
    if (protein) add('pieces', n('Pieces', 'القطع'), Object.keys(protein.prices).map((count) => ({ value: count, label: count })));
    if (kind.topping) add('topping', n(kind.topping.name, kind.topping.nameAr), kind.topping.options.map((item) => ({ value: item.id, label: n(item.name, item.nameAr) })));
    if (kind.style) add('style', n(kind.style.name, kind.style.nameAr), kind.style.options.map((item) => ({ value: item.id, label: n(item.name, item.nameAr) })));
  } else if (kind.type === 'sauce-price') {
    add('sauce', n('Sauce', 'الصلصة'), kind.sauces.map((item) => ({ value: item.id, label: n(item.name, item.nameAr) })));
  } else if (kind.type === 'spicy-toggle') {
    add('spicy', n('Heat', 'الحرارة'), [{ value: '0', label: n('Mild', 'عادي') }, { value: '1', label: n('Spicy', 'حار') }]);
  } else if (kind.type === 'size-price') {
    add('size', n('Size', 'الحجم'), kind.sizes.map((item) => ({ value: item.id, label: n(item.name, item.nameAr) })));
    if (kind.flavors) add('flavor', n(kind.flavors.name, kind.flavors.nameAr), kind.flavors.options.map((item) => ({ value: item.id, label: n(item.name, item.nameAr) })));
  } else if (kind.type === 'deal-box') {
    add('starter', n('Starter', 'المقبلات'), kind.starters.map((item) => ({ value: item.id, label: n(item.name, item.nameAr) })));
    add('sushi', n('Sushi', 'السوشي'), kind.sushi.map((item) => ({ value: item.id, label: n(item.name, item.nameAr) })));
  } else if (kind.type === 'party-box') {
    add('starters', n('Starters', 'المقبلات'), kind.starters.map((item) => ({ value: item.id, label: n(item.name, item.nameAr) })), true);
  } else if (kind.type === 'addons') {
    if (kind.spicyOptional) add('spicy', n('Heat', 'الحرارة'), [{ value: '0', label: n('Mild', 'عادي') }, { value: '1', label: n('Spicy', 'حار') }]);
    if (kind.includedPicks) add('picks', n(kind.includedPicks.name, kind.includedPicks.nameAr), kind.includedPicks.options.map((item) => ({ value: item.id, label: n(item.name, item.nameAr) })), true);
    kind.freeChoices?.forEach((group) => add(group.id, n(group.name, group.nameAr), group.options.map((item) => ({ value: item.id, label: n(item.name, item.nameAr) }))));
  }
  if (dish.freeDips?.length) add('dip', n('Dip', 'التغميس'), dish.freeDips.map((item) => ({ value: item.id, label: n(item.name, item.nameAr) })));
  const extras = kind.type === 'addons' ? kind.extras : dish.extras;
  if (extras?.length) add('extras', n('Extras', 'إضافات'), extras.map((item) => ({ value: item.id, label: n(item.name, item.nameAr) })), true);
  return groups;
}

function chosen(sel: Selection, key: string) {
  if (key === 'spicy') return sel.spicy ? '1' : '0';
  if (key === 'pieces') return sel.pieces == null ? '' : String(sel.pieces);
  const value = sel[key as keyof Selection];
  return typeof value === 'string' ? value : '';
}

function withChoice(dish: Dish, sel: Selection, key: string, value: string): Selection {
  const next: Selection = { ...sel };
  if (key === 'spicy') next.spicy = value === '1';
  else if (key === 'pieces') next.pieces = Number(value) as Selection['pieces'];
  else if (key === 'extras' || key === 'starters' || key === 'picks') {
    const current = (next[key] ?? []) as string[];
    next[key] = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
  } else {
    (next as Record<string, unknown>)[key] = value;
  }
  if (key === 'protein' && dish.kind.type === 'roll') {
    const protein = dish.kind.proteins.find((item) => item.id === value);
    if (protein) next.pieces = preferredPieces(protein.prices);
  }
  return next;
}

function EditSheet({ kind, line, dish, dishes, data, busy, error, reasonCode, note, reasons, text, lang, money, onReason, onNote, onClose, onApply }: {
  kind: SheetKind;
  line: Line | null;
  dish: Dish | undefined;
  dishes: Dish[];
  data: OrderDetailData;
  busy: boolean;
  error: string;
  reasonCode: EditReason;
  note: string;
  reasons: Record<EditReason, string>;
  text: (en: string, ar: string) => string;
  lang: 'en' | 'ar';
  money: (minor: number) => string;
  onReason: (reason: EditReason) => void;
  onNote: (note: string) => void;
  onClose: () => void;
  onApply: (body: Record<string, unknown>) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useModal(ref);
  const [raw, setRaw] = useState(kind === 'qty' ? String(line?.quantity ?? 1) : kind === 'price' ? ((line?.unitMinor ?? 0) / 100).toFixed(2) : '10');
  const [mode, setMode] = useState<'percent' | 'amount'>('percent');
  const [selection, setSelection] = useState<Selection>(line?.selection ? { ...line.selection } : {});
  const [query, setQuery] = useState('');
  const [addDish, setAddDish] = useState<Dish | null>(null);
  const [addQty, setAddQty] = useState(1);
  const title = {
    qty: text('Quantity', 'الكمية'),
    price: text('Price', 'السعر'),
    modifier: text('Modifier', 'الخيار'),
    discount: text('Discount', 'خصم'),
    order_discount: text('Order discount', 'خصم الطلب'),
    add: text('Add item', 'إضافة صنف'),
  }[kind];
  const applyLabel = {
    qty: text('Change quantity', 'تغيير الكمية'),
    price: text('Change price', 'تغيير السعر'),
    modifier: text('Update modifier', 'تحديث الخيار'),
    discount: text('Apply discount', 'تطبيق الخصم'),
    order_discount: text('Apply order discount', 'تطبيق خصم الطلب'),
    add: text('Add item', 'إضافة صنف'),
  }[kind];
  const activeDish = kind === 'add' ? addDish : dish;
  const groups = activeDish ? choiceGroups(activeDish, kind === 'add' ? selection : selection, lang) : [];
  let edit: ResolvedEdit | null = null;
  const qty = Number(raw);
  const decimal = Number(raw);
  if (kind === 'qty' && line && Number.isInteger(qty) && qty >= 1 && qty <= 20) edit = { kind: 'qty', lineId: line.id, quantity: qty };
  if (kind === 'price' && line && Number.isFinite(decimal) && decimal >= 0) edit = { kind: 'line_price', lineId: line.id, unitMinor: Math.round(decimal * 100) };
  if (kind === 'modifier' && line && activeDish) edit = { kind: 'modifier', lineId: line.id, selection, unitMinor: Math.round(unitPrice(activeDish, selection) * 100) };
  if ((kind === 'discount' || kind === 'order_discount') && Number.isFinite(decimal) && decimal > 0 && (mode === 'amount' || decimal <= 100)) {
    const discount = mode === 'percent' ? { mode: 'percent' as const, bp: Math.round(decimal * 100) } : { mode: 'amount' as const, amountMinor: Math.round(decimal * 100) };
    edit = kind === 'discount' && line ? { kind: 'line_discount', lineId: line.id, discount } : kind === 'order_discount' ? { kind: 'order_discount', discount } : null;
  }
  if (kind === 'add' && addDish && addQty >= 1 && addQty <= 20) {
    edit = { kind: 'add_item', line: { id: 'preview', dishId: addDish.id, name: addDish.name, nameAr: addDish.nameAr, quantity: addQty, unitMinor: Math.round(unitPrice(addDish, selection) * 100), note: '', voided: false, compliment: false, discount: null, selection, categoryName: '', categoryNameAr: '', categoryOrder: 0 } };
  }
  let preview: { subtotal: number; total: number } | null = null;
  let previewError = '';
  if (edit) {
    try {
      const projected = applyEdits(asWorking(data.currentLines), [edit]);
      const orderOff = projected.discounts.filter((item) => item.scope === 'order').reduce((sum, item) => sum + item.amountMinor, 0);
      preview = { subtotal: projected.totalMinor + orderOff, total: projected.totalMinor };
    } catch { previewError = text('That discount is larger than the amount due.', 'هذا الخصم أكبر من المبلغ المستحق.'); }
  }
  const before = data.totalMinor;
  const increase = Boolean(data.paidAt && preview && preview.total > before);
  const blocked = increase || Boolean(previewError);
  const body = kind === 'add' && addDish
    ? { kind: 'add_item', dishId: addDish.id, selection, quantity: addQty }
    : edit?.kind === 'qty' ? { kind: 'qty', lineId: line?.id, quantity: edit.quantity }
    : edit?.kind === 'line_price' ? { kind: 'line_price', lineId: line?.id, unitMinor: edit.unitMinor }
    : edit?.kind === 'modifier' ? { kind: 'modifier', lineId: line?.id, selection: edit.selection }
    : edit?.kind === 'line_discount' ? { kind: 'line_discount', lineId: line?.id, ...edit.discount }
    : edit?.kind === 'order_discount' ? { kind: 'order_discount', ...edit.discount }
    : null;

  return <dialog ref={ref} className="order-edit-dialog" onClose={onClose}>
    <div className="admin-dialog-head"><h2>{title}</h2></div>
    <div className="admin-dialog-body">
      {(error || previewError || increase) && <p role="alert" className="staff-error">{error || previewError || text('A paid order cannot be increased.', 'لا يمكن زيادة طلب مدفوع.')}</p>}
      <div className="order-edit-grid">
        <div className="order-edit-fields">
          {kind === 'qty' && <div className="order-edit-stepper">
            <button type="button" onClick={() => setRaw(String(Math.max(1, qty - 1)))} aria-label={text('Decrease', 'إنقاص')}>−</button>
            <input inputMode="numeric" aria-label={text('Quantity', 'الكمية')} value={raw} onChange={(event) => setRaw(event.target.value)} />
            <button type="button" onClick={() => setRaw(String(Math.min(20, (Number.isFinite(qty) ? qty : 0) + 1)))} aria-label={text('Increase', 'زيادة')}>+</button>
          </div>}
          {kind === 'price' && <label>{text('Unit price', 'سعر الوحدة')}<input inputMode="decimal" value={raw} onChange={(event) => setRaw(event.target.value)} /></label>}
          {(kind === 'discount' || kind === 'order_discount') && <>
            <div className="admin-tabs" role="tablist">
              <button type="button" role="tab" aria-selected={mode === 'percent'} onClick={() => setMode('percent')}>{text('Percent', 'نسبة')}</button>
              <button type="button" role="tab" aria-selected={mode === 'amount'} onClick={() => setMode('amount')}>{text('Amount', 'مبلغ')}</button>
            </div>
            <label>{mode === 'percent' ? text('Percent', 'نسبة') : text('Amount', 'مبلغ')}<input inputMode="decimal" value={raw} onChange={(event) => setRaw(event.target.value)} /></label>
          </>}
          {kind === 'add' && !addDish && <>
            <label>{text('Add item', 'إضافة صنف')}<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={text('Search the menu', 'ابحث في القائمة')} /></label>
            <ul className="order-edit-results">{dishes.filter((item) => item.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8).map((item) => <li key={item.id}><button type="button" onClick={() => { setAddDish(item); setSelection(defaultSelection(item)); }}>{lang === 'ar' ? item.nameAr || item.name : item.name}</button></li>)}</ul>
          </>}
          {kind === 'add' && addDish && <div className="order-edit-stepper">
            <button type="button" onClick={() => setAddQty(Math.max(1, addQty - 1))} aria-label={text('Decrease', 'إنقاص')}>−</button>
            <input inputMode="numeric" aria-label={text('Quantity', 'الكمية')} value={String(addQty)} onChange={(event) => setAddQty(Number(event.target.value))} />
            <button type="button" onClick={() => setAddQty(Math.min(20, addQty + 1))} aria-label={text('Increase', 'زيادة')}>+</button>
          </div>}
          {groups.length > 0 && (kind === 'modifier' || (kind === 'add' && addDish)) && groups.map((group) => <div key={group.key}>
            <p>{group.label}</p>
            <div className="admin-tabs" role="tablist">
              {group.options.map((option) => {
                const on = group.multi ? ((selection[group.key as keyof Selection] as string[] | undefined) ?? []).includes(option.value) : chosen(selection, group.key) === option.value;
                return <button type="button" role="tab" key={option.value} aria-selected={on} onClick={() => activeDish && setSelection(withChoice(activeDish, selection, group.key, option.value))}>{option.label}</button>;
              })}
            </div>
          </div>)}
          <label>{text('Reason', 'السبب')}<select value={reasonCode} onChange={(event) => onReason(event.target.value as EditReason)}>{editReasons.map((reason) => <option key={reason} value={reason}>{reasons[reason]}</option>)}</select></label>
          <label>{text('Note', 'ملاحظة')}<textarea value={note} maxLength={140} onChange={(event) => onNote(event.target.value)} /></label>
        </div>
        <div className="order-edit-side">
          <p><span>{text('Subtotal', 'المجموع الفرعي')}</span><span>{money(preview?.subtotal ?? before)}</span></p>
          <p><span>{text('Change', 'التغيير')}</span><span>{money((preview?.total ?? before) - before)}</span></p>
          <p><span>{text('New total', 'الإجمالي الجديد')}</span><strong>{money(preview?.total ?? before)}</strong></p>
          {preview && preview.subtotal !== before && <p><span>{text('Was', 'كان')}</span><span>{money(before)}</span></p>}
          {data.paidAt && <p><span>{text('Owed back', 'المبلغ المسترد')}</span><span>{money(data.owedBackMinor + Math.max(0, before - (preview?.total ?? before)))}</span></p>}
        </div>
      </div>
    </div>
    <div className="admin-dialog-foot">
      <button type="button" onClick={onClose}>{text('Cancel', 'إلغاء')}</button>
      <button type="button" className="primary" disabled={busy || !body || blocked} onClick={() => body && onApply(body)}>{applyLabel}</button>
    </div>
  </dialog>;
}

function ConfirmEdit({ kind, line, data, busy, error, text, money, onCancel, onApply }: {
  kind: 'void' | 'compliment';
  line: Line;
  data: OrderDetailData;
  busy: boolean;
  error: string;
  text: (en: string, ar: string) => string;
  money: (minor: number) => string;
  onCancel: () => void;
  onApply: () => void;
}) {
  let total = data.totalMinor;
  try {
    total = applyEdits(asWorking(data.currentLines), [kind === 'void' ? { kind: 'void', lineId: line.id } : { kind: 'compliment', lineId: line.id }]).totalMinor;
  } catch { /* keep the current total */ }
  const amount = line.voided ? 0 : line.unitMinor * line.quantity;
  return <form className="admin-confirm" onSubmit={(event) => { event.preventDefault(); onApply(); }}>
    {error && <p role="alert" className="staff-error">{error}</p>}
    <p>{kind === 'void' ? text('Void this line?', 'إلغاء هذا الصنف؟') : text('Comp this line?', 'إهداء هذا الصنف؟')}</p>
    <p><span>{text('Amount', 'المبلغ')}</span> {money(amount)}</p>
    <p><span>{text('New total', 'الإجمالي الجديد')}</span> {money(total)}</p>
    <div className="admin-actions">
      <button className="primary" disabled={busy} type="submit">{kind === 'void' ? text('Void line', 'إلغاء الصنف') : text('Comp line', 'إهداء الصنف')}</button>
      <button type="button" onClick={onCancel}>{text('Cancel', 'إلغاء')}</button>
    </div>
  </form>;
}
