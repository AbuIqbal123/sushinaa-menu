import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { copyMenuAndMedia, CopyRefused, readOnlySource } from "../scripts/copy-to-dev";
import { migrate, MigrateRefused } from "../scripts/migrate";
import { checkMigrationDir, migrationViolations } from "../scripts/check-migrations";
import { secretHits } from "../scripts/secret-scan";
import { LIVE_DATABASE_HOST } from "../src/lib/deploy-env";

const SCHEMA = [
  `CREATE TABLE menu (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, content TEXT NOT NULL)`,
  `CREATE TABLE media (id TEXT PRIMARY KEY, content BLOB NOT NULL, type TEXT NOT NULL)`,
  `CREATE TABLE sessions (token TEXT PRIMARY KEY, expires INTEGER NOT NULL)`,
  `CREATE TABLE audit (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, actor TEXT, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT, label TEXT, diff TEXT, ip TEXT, user_agent TEXT)`,
  `CREATE TABLE login_attempts (key TEXT PRIMARY KEY, failures INTEGER NOT NULL, started INTEGER NOT NULL)`,
];

async function sourceDb(dir: string, revision: number) {
  const url = `file:${dir}/source.db`;
  const db = createClient({ url });
  await db.batch(SCHEMA, "write");
  await db.execute({
    sql: "INSERT INTO menu (id, revision, content) VALUES (1, ?, ?)",
    args: [revision, JSON.stringify({ dishes: [{ id: "burger" }, { id: "gyoza" }] })],
  });
  await db.execute({
    sql: "INSERT INTO media (id, content, type) VALUES (?, ?, ?)",
    args: ["abc", Buffer.from("photo"), "image/webp"],
  });
  await db.execute({
    sql: "INSERT INTO sessions (token, expires) VALUES (?, ?)",
    args: ["secret-session", 1],
  });
  await db.execute({
    sql: "INSERT INTO audit (at, action, entity_type) VALUES ('t', 'edit', 'dish')",
    args: [],
  });
  await db.execute({
    sql: "INSERT INTO login_attempts (key, failures, started) VALUES ('ip', 1, 1)",
    args: [],
  });
  db.close();
  return url;
}

test("the copy refreshes dev, writes the marker once, and never reads private tables", async () => {
  const dir = mkdtempSync(join(tmpdir(), "sushinaa-copy-"));
  const sourceUrl = await sourceDb(dir, 4);
  const targetUrl = `file:${dir}/target.db`;
  const first = await copyMenuAndMedia({
    sourceUrl,
    targetUrl,
    allowFileFixture: true,
  });
  assert.deepEqual(first, { revision: 4, dishes: 2, media: 1 });

  const target = createClient({ url: targetUrl });
  const marker = await target.execute("SELECT environment FROM env_marker WHERE id = 1");
  assert.equal(marker.rows[0].environment, "development");
  const media = await target.execute("SELECT id, type FROM media");
  assert.equal(String(media.rows[0].id), "abc");
  await assert.rejects(target.execute("SELECT * FROM sessions"), /no such table/i);
  await assert.rejects(target.execute("SELECT * FROM audit"), /no such table/i);
  await assert.rejects(target.execute("SELECT * FROM login_attempts"), /no such table/i);
  target.close();

  const source = createClient({ url: sourceUrl });
  await source.execute({
    sql: "UPDATE menu SET revision = 5, content = ? WHERE id = 1",
    args: [JSON.stringify({ dishes: [{ id: "burger" }] })],
  });
  const stillThere = await source.execute("SELECT COUNT(*) AS n FROM sessions");
  assert.equal(Number(stillThere.rows[0].n), 1);
  source.close();

  const second = await copyMenuAndMedia({ sourceUrl, targetUrl, allowFileFixture: true });
  assert.equal(second.revision, 5);
  assert.equal(second.dishes, 1);
});

test("the copy refuses the live database and a target that is not development", async () => {
  const live = `libsql://${LIVE_DATABASE_HOST}`;
  await assert.rejects(
    copyMenuAndMedia({ sourceUrl: "file:/tmp/a.db", targetUrl: live }),
    CopyRefused,
  );
  await assert.rejects(
    copyMenuAndMedia({ sourceUrl: "file:/tmp/a.db", targetUrl: "file:/tmp/b.db" }),
    /source must be the live database/i,
  );

  const dir = mkdtempSync(join(tmpdir(), "sushinaa-copy-refuse-"));
  const sourceUrl = await sourceDb(dir, 1);
  const targetUrl = `file:${dir}/target.db`;
  const target = createClient({ url: targetUrl });
  await target.execute(
    "CREATE TABLE env_marker (id INTEGER PRIMARY KEY CHECK (id = 1), environment TEXT NOT NULL)",
  );
  await target.execute("INSERT INTO env_marker (id, environment) VALUES (1, 'production')");
  await target.execute(
    "CREATE TABLE menu (id INTEGER PRIMARY KEY, revision INTEGER NOT NULL, content TEXT NOT NULL)",
  );
  await target.execute({
    sql: "INSERT INTO menu (id, revision, content) VALUES (1, 9, ?)",
    args: ["keep"],
  });
  target.close();

  await assert.rejects(
    copyMenuAndMedia({ sourceUrl, targetUrl, allowFileFixture: true }),
    /not development/,
  );
  const after = createClient({ url: targetUrl });
  const menu = await after.execute("SELECT content FROM menu WHERE id = 1");
  assert.equal(String(menu.rows[0].content), "keep");
  after.close();
});

test("the source client rejects anything except menu and media", async () => {
  const dir = mkdtempSync(join(tmpdir(), "sushinaa-ro-"));
  const url = await sourceDb(dir, 1);
  const source = readOnlySource(createClient({ url }));
  await assert.rejects(source.execute("SELECT * FROM sessions"), CopyRefused);
  await assert.rejects(source.batch(["DELETE FROM menu"], "write"), CopyRefused);
  source.close();
});

test("migrations apply once on a file database and refuse the live database", async () => {
  const dir = mkdtempSync(join(tmpdir(), "sushinaa-migrate-"));
  const url = `file:${dir}/menu.db`;
  assert.equal(await migrate(url), 1);
  assert.equal(await migrate(url), 0);
  const db = createClient({ url });
  const tables = await db.execute(
    "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
  );
  const names = tables.rows.map((row) => String(row.name));
  assert.ok(names.includes("menu"));
  assert.ok(names.includes("schema_migrations"));
  const applied = await db.execute("SELECT id FROM schema_migrations");
  assert.equal(String(applied.rows[0].id), "0001");
  db.close();
  await assert.rejects(migrate(`libsql://${LIVE_DATABASE_HOST}`), MigrateRefused);
});

test("migration files cannot drop or rename, and the secret scan catches tokens", () => {
  assert.deepEqual(checkMigrationDir(join(process.cwd(), "db/migrations")), []);
  assert.equal(migrationViolations("ALTER TABLE menu RENAME TO old;").length, 1);
  assert.equal(migrationViolations("DROP TABLE menu;").length, 1);
  assert.deepEqual(secretHits("notes.md", "token eyJabc.def.ghi"), []);
  assert.equal(
    secretHits("notes.md", "CMS_DATABASE_AUTH_TOKEN=\"abcdefghijklm\"").length,
    1,
  );
  assert.deepEqual(secretHits(".env.example", "CMS_DATABASE_AUTH_TOKEN=\"abcdefghijklm\""), []);
});
