import type { Category, CmsDish, MenuData } from "./schema";

/**
 * How long guest-facing text can be, in characters, shared by the editor's
 * counters and the server's save check. Measured at 360px, the narrowest
 * phone the menu supports, in each language's own font:
 * - name: two lines of card title beside a "from 1,234 QAR" price
 *   (37 English / 44 Arabic characters fit).
 * - description: five lines in the options sheet (about 217 / 240 fit);
 *   the card itself shows the first two.
 * - option: one line in an option row.
 * - category: one line in the category picker.
 * Every seeded value is well inside these. Text already saved over a limit
 * is left as it is: only new or changed text is checked, and nothing is
 * ever cut short.
 */
export const LIMITS = {
  name: { en: 36, ar: 42 },
  description: { en: 200, ar: 220 },
  option: { en: 28, ar: 28 },
  category: { en: 20, ar: 20 },
} as const;

type Kind = keyof typeof LIMITS;
export type LimitIssue = { code: "custom"; path: (string | number)[]; message: string };

/** Characters as people count them, not UTF-16 units. */
export const characters = (s: string) => [...s].length;

/** The limit for a field: `name`/`nameAr` and friends map to en/ar. */
export function limitOf(kind: Kind, key: string): number {
  return LIMITS[kind][key.endsWith("Ar") ? "ar" : "en"];
}

function at(v: unknown, path: (string | number)[]): unknown {
  return path.reduce<unknown>(
    (o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined),
    v,
  );
}

function check(
  out: LimitIssue[],
  kind: Kind,
  root: unknown,
  before: unknown,
  path: (string | number)[],
) {
  const value = at(root, path);
  if (typeof value !== "string" || value === at(before, path)) return;
  const max = limitOf(kind, String(path[path.length - 1]));
  if (characters(value) > max)
    out.push({ code: "custom", path, message: `Keep it to ${max} characters or fewer.` });
}

/** Over-limit text in a dish that differs from `before` (the saved version). */
export function dishLimitIssues(dish: CmsDish, before?: CmsDish): LimitIssue[] {
  const out: LimitIssue[] = [];
  for (const key of ["name", "nameAr"]) check(out, "name", dish, before, [key]);
  for (const key of ["description", "descriptionAr"]) check(out, "description", dish, before, [key]);
  // Every named thing inside the options: proteins, sauces, extras, picks...
  const walk = (v: unknown, path: (string | number)[]) => {
    if (Array.isArray(v)) v.forEach((x, i) => walk(x, [...path, i]));
    else if (v && typeof v === "object")
      for (const [k, x] of Object.entries(v)) {
        if (k === "name" || k === "nameAr") check(out, "option", dish, before, [...path, k]);
        else walk(x, [...path, k]);
      }
  };
  for (const key of ["kind", "extras", "freeDips"] as const) walk(dish[key], [key]);
  return out;
}

export function categoryLimitIssues(category: Category, before?: Category): LimitIssue[] {
  const out: LimitIssue[] = [];
  for (const key of ["name", "nameAr"]) check(out, "category", category, before, [key]);
  return out;
}

/** The same checks across a whole menu, against the stored menu. */
export function menuLimitIssues(menu: MenuData, before?: MenuData): LimitIssue[] {
  const prefix = (p: (string | number)[]) => (i: LimitIssue) => ({ ...i, path: [...p, ...i.path] });
  return [
    ...menu.dishes.flatMap((d, i) =>
      dishLimitIssues(d, before?.dishes.find((b) => b.id === d.id)).map(prefix(["dishes", i])),
    ),
    ...menu.categories.flatMap((c, i) =>
      categoryLimitIssues(c, before?.categories.find((b) => b.id === c.id)).map(
        prefix(["categories", i]),
      ),
    ),
  ];
}
