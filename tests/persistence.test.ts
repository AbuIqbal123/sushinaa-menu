import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
test("seed is idempotent; writes persist on a new connection; stale writes fail", async () => {
  const dir = mkdtempSync(join(tmpdir(), "sushinaa-test-"));
  process.env.CMS_DATABASE_URL = `file:${dir}/menu.db`;
  const { seedMenu, readMenu, saveMenu, ConflictError } =
    await import("../src/cms/repository");
  const { db } = await import("../src/cms/db");
  const who = { actor: "test", ip: null, userAgent: null };
  try {
    const initial = JSON.parse(readFileSync("data/initial-menu.json", "utf8"));
    await seedMenu(initial);
    const before = await readMenu();
    before.menu.dishes[0].description = "Persistence test";
    await saveMenu(before.menu, before.revision, who);
    await seedMenu(initial);
    assert.equal(
      (await readMenu()).menu.dishes[0].description,
      "Persistence test",
    );
    await assert.rejects(
      saveMenu(before.menu, before.revision, who),
      ConflictError,
    );
    const reopened = createClient({ url: process.env.CMS_DATABASE_URL });
    const r = await reopened.execute("SELECT content FROM menu WHERE id=1");
    assert.equal(
      JSON.parse(String(r.rows[0].content)).dishes[0].description,
      "Persistence test",
    );
    reopened.close();
    // The server refuses new text over a limit and saves nothing.
    const now = await readMenu();
    now.menu.dishes[0].name = "x".repeat(80);
    await assert.rejects(saveMenu(now.menu, now.revision, who), (e: Error) =>
      e.message.includes("Keep it to 36 characters or fewer."),
    );
    assert.equal((await readMenu()).revision, now.revision);
    // Only the save that went through left a row; reseeding kept it.
    const rows = await db.execute("SELECT action,entity_id,diff FROM audit");
    assert.deepEqual(
      rows.rows.map((r) => [r.action, r.entity_id]),
      [["item.update", before.menu.dishes[0].id]],
    );
    assert.equal(
      JSON.parse(String(rows.rows[0].diff)).description.to,
      "Persistence test",
    );
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
