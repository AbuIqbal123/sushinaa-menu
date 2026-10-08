import type { InStatement } from "@libsql/client";
import type { MenuData } from "./schema";

// Append-only activity log. Rows are only ever inserted, in the same
// transaction as the change they describe; triggers refuse edits and deletes.
export const AUDIT_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, actor TEXT, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT, label TEXT, diff TEXT, ip TEXT, user_agent TEXT)`,
  `CREATE TRIGGER IF NOT EXISTS audit_append_only_update BEFORE UPDATE ON audit BEGIN SELECT RAISE(ABORT, 'audit is append-only'); END`,
  `CREATE TRIGGER IF NOT EXISTS audit_append_only_delete BEFORE DELETE ON audit BEGIN SELECT RAISE(ABORT, 'audit is append-only'); END`,
];

export type AuditContext = { actor: string | null; ip: string | null; userAgent: string | null };
export type AuditEntry = {
  action: string;
  entityType: string;
  entityId?: string | null;
  label?: string | null;
  diff?: unknown;
};

const cap = (value: string | null | undefined, max: number) =>
  value ? [...value].slice(0, max).join("") : null;

/** Who and where, from the request. Never reads cookies or credentials. */
export function auditContext(request: Request, actor: string | null): AuditContext {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0].trim();
  return {
    actor: cap(actor, 64),
    ip: cap(forwarded, 64),
    userAgent: cap(request.headers.get("user-agent"), 200),
  };
}

export function auditInsert(ctx: AuditContext, entry: AuditEntry): InStatement {
  return {
    sql: "INSERT INTO audit (at,actor,action,entity_type,entity_id,label,diff,ip,user_agent) VALUES (?,?,?,?,?,?,?,?,?)",
    args: [
      new Date().toISOString(),
      ctx.actor,
      entry.action,
      entry.entityType,
      entry.entityId ?? null,
      cap(entry.label, 120),
      entry.diff === undefined ? null : JSON.stringify(entry.diff),
      ctx.ip,
      ctx.userAgent,
    ],
  };
}

type Diff = Record<string, { from: unknown; to: unknown }>;

function fieldDiff(before: object, after: object, ignore: string[] = []): Diff {
  const diff: Diff = {};
  const a = before as Record<string, unknown>;
  const b = after as Record<string, unknown>;
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (ignore.includes(key)) continue;
    if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) diff[key] = { from: a[key] ?? null, to: b[key] ?? null };
  }
  return diff;
}

// One row per created, deleted or changed entity. A change to visibility alone
// is a hide or show, a change to position alone is a reorder.
function entityChanges<T extends { id: string; name?: string }>(
  type: string, before: T[], after: T[], ignore: string[] = [],
): AuditEntry[] {
  const old = new Map(before.map((e) => [e.id, e]));
  const now = new Map(after.map((e) => [e.id, e]));
  const out: AuditEntry[] = [];
  for (const e of after) {
    const prev = old.get(e.id);
    const label = e.name ?? e.id;
    if (!prev) { out.push({ action: `${type}.create`, entityType: type, entityId: e.id, label, diff: { after: e } }); continue; }
    const diff = fieldDiff(prev, e, ignore);
    const keys = Object.keys(diff);
    if (!keys.length) continue;
    const action = keys.length === 1 && keys[0] === "visible" ? (e as { visible?: boolean }).visible ? "show" : "hide"
      : keys.length === 1 && keys[0] === "order" ? "reorder" : "update";
    out.push({ action: `${type}.${action}`, entityType: type, entityId: e.id, label, diff });
  }
  for (const e of before)
    if (!now.has(e.id)) out.push({ action: `${type}.delete`, entityType: type, entityId: e.id, label: e.name ?? e.id, diff: { before: e } });
  return out;
}

/** What a save changed, compared field by field with the stored menu. */
export function menuChanges(before: MenuData, after: MenuData): AuditEntry[] {
  const out = [
    ...entityChanges("category", before.categories, after.categories),
    // The editor stamps updatedAt on every save; it is not a change in itself.
    ...entityChanges("item", before.dishes, after.dishes, ["updatedAt"]),
    ...entityChanges("filter", before.filters, after.filters),
  ];
  const prefixed = (lang: "en" | "ar") => Object.fromEntries(
    Object.entries(fieldDiff(before.copy[lang], after.copy[lang])).map(([k, v]) => [`${lang}.${k}`, v]),
  );
  const sections: [string, Diff][] = [
    ["settings", fieldDiff(before.settings, after.settings)],
    ["copy", { ...prefixed("en"), ...prefixed("ar") }],
    ["fields", fieldDiff(before.fields, after.fields)],
  ];
  for (const [type, diff] of sections)
    if (Object.keys(diff).length) out.push({ action: "settings.update", entityType: type, diff });
  return out;
}
