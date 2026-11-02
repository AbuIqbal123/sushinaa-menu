import { z } from 'zod';
import { BRANCHES } from './branches';
const session = z.object({
  open: z.number().int().min(0).max(1439),
  close: z.number().int().min(1).max(2879),
  closed: z.boolean().optional(),
}).strict().refine(s => s.closed || (s.close > s.open && s.close <= s.open + 1440), { message: 'Closing time must be after opening, within 24 hours.', path: ['close'] });
export const branchSettingsSchema = z.object({
  slug: z.enum(['down-town','al-thumama','west-bay','al-khor']),
  name: z.string().trim().min(1,'English name is required.').max(40),
  nameAr: z.string().trim().min(1,'Arabic name is required.').max(40),
  phone: z.string().transform(s => s.replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[\s()-]/g,''))
    .pipe(z.string().regex(/^\+974[3-7]\d{7}$/, 'Enter a Qatar number: +974 followed by 8 digits.')),
  hours: z.array(session).length(7),
}).strict();
export type BranchSettings = z.infer<typeof branchSettingsSchema>;
export const branchListSchema = z.array(branchSettingsSchema).length(4).refine(rows=>new Set(rows.map(row=>row.slug)).size===4,'Keep each of the four branches exactly once.');
export const defaultBranchSettings = () => BRANCHES.map(({slug,name,nameAr,phone,hours})=>({slug,name,nameAr,phone,hours:hours.map(s=>({...s}))}));
