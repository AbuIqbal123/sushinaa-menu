// Internal ids are made once, from the English name, when an entry is first
// saved. They never change on rename (saved selections and history use them).
// A new entry carries an empty id until then.
export function slugify(s: string) {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 60)
    .replace(/^-+|-+$/g, "");
}
export function uniqueId(name: string, taken: Iterable<string>) {
  const used = new Set(taken);
  const base = slugify(name) || `item-${crypto.randomUUID().slice(0, 6)}`;
  let id = base;
  for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
  return id;
}
type Entry = { id?: unknown; name?: unknown };
// Fills empty ids in nested option lists, unique among siblings.
export function fillIds<T>(value: T): T {
  if (Array.isArray(value)) {
    const taken = value.flatMap((x: Entry) =>
      typeof x?.id === "string" && x.id ? [x.id] : [],
    );
    return value.map((x) => {
      const y = fillIds(x) as Entry;
      if (y && typeof y === "object" && y.id === "") {
        y.id = uniqueId(String(y.name ?? ""), taken);
        taken.push(y.id as string);
      }
      return y;
    }) as T;
  }
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, fillIds(v)]),
    ) as T;
  return value;
}
