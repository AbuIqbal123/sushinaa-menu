import { createClient } from "@libsql/client";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { AUDIT_SCHEMA } from "./audit";
// A separate draft site can consume the published menu through its read-only
// endpoint without receiving production CMS credentials. Keep libSQL inert there.
const publicSource = process.env.CMS_PUBLIC_MENU_SOURCE_URL;
const url = process.env.CMS_DATABASE_URL || (publicSource ? 'file:/tmp/sushinaa-preview-unused-menu.db' : 'file:./data/menu.db');
if (process.env.VERCEL && url.startsWith("file:") && !publicSource)
  throw new Error(
    "Set CMS_DATABASE_URL to a remote libSQL database on Vercel. Local files are not persistent there.",
  );
if (url.startsWith("file:"))
  mkdirSync(dirname(url.slice(5)), { recursive: true });
export const db = createClient({
  url,
  authToken: process.env.CMS_DATABASE_AUTH_TOKEN,
});
let ready: Promise<unknown> | undefined;
export function initDb() {
  if (publicSource) throw new Error('The draft menu source is read-only.');
  return (ready ??= db
    .batch(
      [
        `CREATE TABLE IF NOT EXISTS menu (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, content TEXT NOT NULL)`,
        `CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, expires INTEGER NOT NULL)`,
        `CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY, content BLOB NOT NULL, type TEXT NOT NULL)`,
        `CREATE TABLE IF NOT EXISTS login_attempts (key TEXT PRIMARY KEY, failures INTEGER NOT NULL, started INTEGER NOT NULL)`,
        ...AUDIT_SCHEMA,
      ],
      "write",
    )
    .catch((e) => {
      ready = undefined;
      throw e;
    }));
}
