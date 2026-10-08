"use client";
import { useEffect, useState } from "react";

type Row = {
  id: number;
  at: string;
  actor: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  label: string | null;
  diff: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
};
const AREAS = [
  ["", "All activity"],
  ["sessions", "Sign-ins"],
  ["items", "Items"],
  ["categories", "Categories"],
  ["settings", "Settings"],
  ["media", "Photos"],
] as const;
const FIELDS: Record<string, string> = {
  name: "name",
  nameAr: "Arabic name",
  description: "description",
  descriptionAr: "Arabic description",
  section: "category",
  image: "card photo",
  optionsImage: "options photo",
  imageFocus: "focal point",
  imageAlt: "photo description",
  imageAltAr: "Arabic photo description",
  kind: "price and options",
  extras: "extras",
  freeDips: "free dips",
  piecesNote: "pieces note",
  order: "position",
  visible: "visibility",
  available: "availability",
  featured: "featured",
  tags: "tags",
  logo: "menu logo",
  documentLogo: "document logo",
  whatsappE164: "WhatsApp number",
};
const field = (key: string) =>
  FIELDS[key] ?? key.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
const noun: Record<string, string> = {
  item: "item",
  category: "category",
  filter: "filter",
};
const SECTIONS: Record<string, string> = {
  settings: "Changed settings",
  copy: "Changed menu wording",
  fields: "Changed field names",
};

export function describe(row: Row) {
  const [, verb] = row.action.split(".");
  const name = `“${row.label ?? row.entityId}”`;
  const changed = row.diff ? Object.keys(row.diff).map(field).join(", ") : "";
  switch (row.action) {
    case "session.sign_in":
      return "Signed in";
    case "session.sign_out":
      return "Signed out";
    case "session.sign_in_failed":
      return "Failed sign-in";
    case "media.upload":
      return `Uploaded a photo${row.label ? ` (${row.label})` : ""}`;
    case "settings.update":
      return `${SECTIONS[row.entityType] ?? "Changed settings"}: ${changed}`;
  }
  const what = noun[row.entityType] ?? row.entityType;
  return (
    {
      create: `Added ${what} ${name}`,
      delete: `Deleted ${what} ${name}`,
      hide: `Hid ${what} ${name}`,
      show: `Showed ${what} ${name}`,
      reorder: `Moved ${what} ${name}`,
      update: `Changed ${what} ${name}: ${changed}`,
    }[verb] ?? row.action
  );
}

const show = (v: unknown) => {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  if (s === undefined || s === "null" || s === "") return "—";
  return s.length > 160 ? `${s.slice(0, 160)}…` : s;
};

// Field-by-field changes; creates and deletes keep a snapshot instead.
function changes(row: Row) {
  if (!row.diff || row.action === "media.upload" || "after" in row.diff || "before" in row.diff)
    return [];
  return Object.entries(row.diff as Record<string, { from: unknown; to: unknown }>);
}

function Detail({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div>
      <dt>{term}</dt>
      <dd dir="auto">{children}</dd>
    </div>
  );
}

export function Activity() {
  const [area, setArea] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ rows: Row[]; more: boolean } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    fetch(`/api/admin/activity?area=${area}&page=${page}`)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error);
        if (live) {
          setData(body);
          setError("");
        }
      })
      .catch((e) => live && setError(e instanceof Error ? e.message : "Unable to load activity"));
    return () => {
      live = false;
    };
  }, [area, page]);
  return (
    <>
      <div className="admin-toolbar">
        <select
          aria-label="Show activity for"
          value={area}
          onChange={(e) => {
            setArea(e.target.value);
            setPage(1);
          }}
        >
          {AREAS.map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <div className="admin-error" role="alert">
          {error}
        </div>
      )}
      {data && !data.rows.length && (
        <p className="admin-empty">Nothing recorded yet.</p>
      )}
      <ol className="admin-activity" aria-busy={!data}>
        {data?.rows.map((row) => (
          <li key={row.id}>
            <div className="activity-line">
              <strong>{describe(row)}</strong>
              <time dateTime={row.at} title={`${row.at} UTC`}>
                {new Date(row.at).toLocaleString("en-GB", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
            </div>
            <details>
              <summary>Details</summary>
              <dl>
                {row.action !== "session.sign_in_failed" && row.actor && (
                  <Detail term="By">{row.actor}</Detail>
                )}
                {changes(row).map(([key, change]) => (
                  <Detail key={key} term={field(key)}>
                    {show(change.from)} → {show(change.to)}
                  </Detail>
                ))}
                <Detail term="IP address">{row.ip ?? "Not recorded"}</Detail>
                <Detail term="Device">{row.userAgent ?? "Not recorded"}</Detail>
              </dl>
            </details>
          </li>
        ))}
      </ol>
      {data && (page > 1 || data.more) && (
        <nav className="admin-pager" aria-label="Activity pages">
          <button disabled={page === 1} onClick={() => setPage(page - 1)}>
            Newer
          </button>
          <span>Page {page}</span>
          <button disabled={!data.more} onClick={() => setPage(page + 1)}>
            Older
          </button>
        </nav>
      )}
    </>
  );
}
