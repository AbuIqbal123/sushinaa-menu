import { createClient } from "@libsql/client";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { AUDIT_SCHEMA } from "./audit";
import type { Client } from "@libsql/client";
import { EDIT_SQL, ORDER_NUMBER_SQL, ORDER_SCHEMA, PRINT_SQL, STAFF_SCHEMA } from "@/ordering/schema";
import { orderDatabaseAllowed } from "@/ordering/guard";
// Capture configuration once, but create no connection or files during route imports.
export const databaseUrl = process.env.CMS_DATABASE_URL || "file:./data/menu.db";
let client: Client | undefined;
export const db = new Proxy({} as Client, {
  get(_target, key) {
    if (!client) {
      if (process.env.VERCEL && databaseUrl.startsWith("file:"))
        throw new Error("Set CMS_DATABASE_URL to a remote libSQL database on Vercel.");
      if (databaseUrl.startsWith("file:")) mkdirSync(dirname(databaseUrl.slice(5)), { recursive: true });
      client = createClient({ url: databaseUrl, authToken: process.env.CMS_DATABASE_AUTH_TOKEN,
        // SQLite has one writer. Avoid pooling competing native write transactions locally.
        ...(databaseUrl.startsWith("file:") ? { concurrency: 1 } : {}),
      });
    }
    const value = Reflect.get(client, key);
    if (typeof value !== "function") return value;
    if (databaseUrl.startsWith("file:") && ["execute", "batch", "transaction"].includes(String(key))) {
      return async (...args: unknown[]) => {
        for (let attempt = 0; ; attempt++) {
          try { return await value.apply(client, args); }
          catch (error) {
            // The driver reports pool exhaustion before executing SQL when a transaction
            // owns its only connection. Let that transaction finish, then try to acquire.
            if (attempt >= 100 || !(error instanceof Error) || !("code" in error) || error.code !== "TRANSACTION_ACTIVE") throw error;
            await new Promise(resolve => setTimeout(resolve, 10));
          }
        }
      };
    }
    return value.bind(client);
  },
});
const CORE_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS menu (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, content TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, expires INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY, content BLOB NOT NULL, type TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS login_attempts (key TEXT PRIMARY KEY, failures INTEGER NOT NULL, started INTEGER NOT NULL)`,
  ...AUDIT_SCHEMA,
];

/** Staff and order tables exist only where ordering is allowed. Production keeps the sessions table. */
export function startupStatements(url: string) {
  return [
    ...CORE_SCHEMA,
    ...(orderDatabaseAllowed(url) ? [...STAFF_SCHEMA, ...ORDER_SCHEMA] : []),
  ];
}

let ready: Promise<unknown> | undefined;

async function ensureOrderColumns() {
  const info = await db.execute("PRAGMA table_info(orders)");
  const have = new Set(info.rows.map((row) => String(row.name)));
  const alters = [...ORDER_NUMBER_SQL, ...PRINT_SQL, ...EDIT_SQL].filter((sql) => {
    const column = /ADD COLUMN (\w+)/.exec(sql)?.[1];
    return column ? !have.has(column) : false;
  });
  if (alters.length) await db.batch(alters, "write");
  const creates = [...ORDER_NUMBER_SQL, ...PRINT_SQL, ...EDIT_SQL].filter((sql) => sql.startsWith("CREATE"));
  if (creates.length) await db.batch(creates, "write");
}

export function initDb() {
  return (ready ??= (async () => {
    const { assertDatabaseAllowed } = await import("./env-guard");
    await assertDatabaseAllowed(db);
    await db.batch(startupStatements(databaseUrl), "write");
    // Abubaker, 2026-10-25: staff tables stay off the production database.
    // Order columns stay behind the same guard.
    if (orderDatabaseAllowed(databaseUrl)) await ensureOrderColumns();
  })().catch((e) => {
    ready = undefined;
    throw e;
  }));
}
