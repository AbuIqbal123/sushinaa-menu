import { z } from 'zod';
import type { Dish, Selection } from '@/catalog/types';
import type { MenuData } from '@/cms/schema';
import { publicMenu } from '@/cms/schema';
import { isSelectionComplete, unitPrice } from '@/ordering/price';
import { branches, branchStatus } from './branches';

export const digits = (value: string) => value.replace(/[٠-٩۰-۹]/g, c => String(c.charCodeAt(0) >= 1776 ? c.charCodeAt(0) - 1776 : c.charCodeAt(0) - 1632));
export const normalizePhone = (value: string) => {
  let n = digits(value).replace(/[\s()+-]/g, '');
  if (n.startsWith('00974')) n = n.slice(2);
  if (n.length === 8) n = `974${n}`;
  return n;
};
const optionalText = (max: number) => z.string().trim().max(max).default('');
export const customerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  phone: z.string().max(30).transform(normalizePhone).pipe(z.string().regex(/^974[3567]\d{7}$/)),
  plate: z.string().transform(s => digits(s).trim()).pipe(z.string().min(1).max(24).regex(/^[\p{L}\p{N}\s-]+$/u).refine(s => /\d/.test(s))),
  colour: optionalText(50), car: optionalText(80), instructions: optionalText(400),
}).strict();
export type Customer = z.infer<typeof customerSchema>;
const option = z.string().min(1).max(100);
const selectionSchema = z.object({
  protein: option.optional(), pieces: z.union([z.literal(4), z.literal(6), z.literal(8), z.literal(12), z.literal(24)]).optional(),
  sauce: option.optional(), spicy: z.boolean().optional(), size: option.optional(), flavor: option.optional(),
  starter: option.optional(), sushi: option.optional(), starters: z.array(option).max(20).optional(),
  extras: z.array(option).max(100).refine(a => new Set(a).size === a.length).optional(),
  picks: z.array(option).max(20).optional(), topping: option.optional(), style: option.optional(), cut: option.optional(), dip: option.optional(),
}).strict();
export const checkoutSchema = z.object({
  branchId: z.enum(['down-town', 'al-thumama', 'west-bay', 'al-khor']),
  customer: customerSchema,
  lines: z.array(z.object({ dishId: option, selection: selectionSchema, quantity: z.number().int().min(1).max(20), note: optionalText(400), expectedUnitMinor: z.number().int().min(0) }).strict()).min(1).max(100),
}).strict();
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export class CheckoutError extends Error {
  constructor(public code: 'CLOSED' | 'UNAVAILABLE' | 'OPTIONS' | 'PRICE_CHANGED' | 'LIMIT' | 'CONFLICT') { super(code); }
}
// The viewing menu tolerates legacy selections; checkout deliberately accepts only options belonging to this dish.
export function validCheckoutSelection(dish: Dish, sel: Selection) {
  if (!isSelectionComplete(dish, sel)) return false;
  const allowed = new Set<string>();
  const required: string[] = [];
  const group = (key: string, exists: unknown) => { if (exists) { allowed.add(key); required.push(key); } };
  if (dish.freeDips?.length) group('dip', true);
  const k = dish.kind;
  if ((k.type === 'addons' ? k.extras : dish.extras)?.length) allowed.add('extras');
  switch (k.type) {
    case 'roll': group('protein', true); group('pieces', true); group('topping', k.topping); group('style', k.style); break;
    case 'spicy-toggle': allowed.add('spicy'); break; // Stored carts omit false: absence means mild.
    case 'sauce-price': group('sauce', true); break;
    case 'deal-box': group('starter', true); group('sushi', true); break;
    case 'party-box': allowed.add('starters'); break;
    case 'size-price': group('size', true); group('flavor', k.flavors); break;
    case 'addons': if (k.spicyOptional) allowed.add('spicy'); if (k.includedPicks) allowed.add('picks'); k.freeChoices?.forEach(g => group(g.id, true)); break;
  }
  return Object.keys(sel).every(key => sel[key as keyof Selection] === undefined || allowed.has(key)) && required.every(key => sel[key as keyof Selection] !== undefined);
}
export function quoteOrder(input: CheckoutInput, menu: MenuData, now = new Date()) {
  const branch = branches.find(b => b.id === input.branchId)!;
  if (!branchStatus(branch, now).open) throw new CheckoutError('CLOSED');
  if (input.lines.reduce((n, line) => n + line.quantity, 0) > 100) throw new CheckoutError('LIMIT');
  const available = publicMenu(menu).dishes;
  const lines = input.lines.map(line => {
    const dish = available.find(d => d.id === line.dishId);
    if (!dish) throw new CheckoutError('UNAVAILABLE');
    if (!validCheckoutSelection(dish, line.selection)) throw new CheckoutError('OPTIONS');
    const unitMinor = Math.round(unitPrice(dish, line.selection) * 100);
    if (unitMinor !== line.expectedUnitMinor) throw new CheckoutError('PRICE_CHANGED');
    return { dishId: dish.id, name: dish.name, nameAr: dish.nameAr, kind: dish.kind, freeDips: dish.freeDips, extras: dish.extras,
      selection: line.selection, quantity: line.quantity, note: line.note, unitMinor, totalMinor: unitMinor * line.quantity };
  });
  return { branchId: branch.id, branchName: branch.name, customer: input.customer, collection: 'car' as const, lines,
    totalMinor: lines.reduce((n, line) => n + line.totalMinor, 0), currency: 'QAR' as const };
}
export type OrderSnapshot = ReturnType<typeof quoteOrder>;
