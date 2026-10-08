import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { menuChanges, auditContext } from "../src/cms/audit";
import { menuSchema } from "../src/cms/schema";

const original = () =>
  menuSchema.parse(JSON.parse(readFileSync("data/initial-menu.json", "utf8")));

test("a save is described as one row per changed entity", () => {
  const before = original();
  const after = structuredClone(before);
  const [a, b, c, d] = after.dishes;
  a.description = "New words";
  a.updatedAt = "2026-10-08T00:00:00.000Z";
  b.visible = false;
  [c.order, d.order] = [d.order, c.order];
  after.dishes.push({ ...structuredClone(a), id: "fresh", name: "Fresh" });
  after.dishes = after.dishes.filter((x) => x.id !== after.dishes[4].id);
  after.categories[1].visible = false;
  after.settings.logo = "/api/media/abc";
  after.copy.ar.close = "اغلاق";
  const rows = menuChanges(before, after);
  const by = (id: string) => rows.find((r) => r.entityId === id);
  assert.deepEqual(by(a.id)?.diff, {
    description: { from: before.dishes[0].description, to: "New words" },
  });
  assert.equal(by(a.id)?.action, "item.update");
  assert.equal(by(b.id)?.action, "item.hide");
  assert.equal(by(c.id)?.action, "item.reorder");
  assert.equal(by(d.id)?.action, "item.reorder");
  assert.equal(by("fresh")?.action, "item.create");
  assert.equal(by(before.dishes[4].id)?.action, "item.delete");
  assert.equal(by(before.categories[1].id)?.action, "category.hide");
  assert.deepEqual(rows.find((r) => r.entityType === "settings")?.diff, {
    logo: { from: before.settings.logo, to: "/api/media/abc" },
  });
  assert.deepEqual(
    Object.keys(rows.find((r) => r.entityType === "copy")?.diff as object),
    ["ar.close"],
  );
  assert.equal(rows.length, 9);
  assert.deepEqual(menuChanges(before, structuredClone(before)), []);
});

test("request details are capped and never include cookies", () => {
  const session = `session-${Date.now()}`;
  const ctx = auditContext(
    new Request("http://x/", {
      headers: {
        "x-forwarded-for": "203.0.113.9, 10.0.0.1",
        "user-agent": "u".repeat(500),
        cookie: `sushinaa-admin=${session}`,
      },
    }),
    "n".repeat(200),
  );
  assert.equal(ctx.ip, "203.0.113.9");
  assert.equal(ctx.userAgent?.length, 200);
  assert.equal(ctx.actor?.length, 64);
  assert.ok(!JSON.stringify(ctx).includes(session));
  assert.equal(auditContext(new Request("http://x/"), null).ip, null);
});

test("the audit table refuses updates and deletes", async () => {
  const dir = mkdtempSync(join(tmpdir(), "sushinaa-audit-"));
  process.env.CMS_DATABASE_URL = `file:${dir}/menu.db`;
  const { db, initDb } = await import("../src/cms/db");
  const { auditInsert } = await import("../src/cms/audit");
  try {
    await initDb();
    await db.execute(
      auditInsert({ actor: "t", ip: null, userAgent: null }, { action: "session.sign_in", entityType: "session" }),
    );
    await assert.rejects(db.execute("UPDATE audit SET actor='x'"), /append-only/);
    await assert.rejects(db.execute("DELETE FROM audit"), /append-only/);
    assert.equal((await db.execute("SELECT count(*) AS n FROM audit")).rows[0].n, 1);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("no code path updates or deletes audit rows", () => {
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx|mjs|js)$/.test(p) ? [p] : [];
    });
  const offenders = [...files("src"), ...files("scripts")].filter((f) =>
    /(UPDATE\s+audit|DELETE\s+FROM\s+audit|DROP\s+TABLE[^;]*audit|REPLACE\s+INTO\s+audit|TRUNCATE)/i.test(
      readFileSync(f, "utf8"),
    ),
  );
  assert.deepEqual(offenders, []);
});
