import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sniffImage } from "../src/cms/media";
import { menuSchema, publicMenu } from "../src/cms/schema";

test("uploads are recognised by their bytes", () => {
  assert.equal(sniffImage(readFileSync("public/dishes/sushinaa-burger.jpg")), "jpeg");
  assert.equal(sniffImage(readFileSync("public/dishes/card/redbull.webp")), "webp");
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
  assert.equal(sniffImage(png), "png");
  assert.equal(sniffImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')), null);
  assert.equal(sniffImage(Buffer.from("GIF89a")), null);
  assert.equal(sniffImage(new Uint8Array()), null);
});

test("the public menu carries nothing admin-only", () => {
  const menu = menuSchema.parse(JSON.parse(readFileSync("data/initial-menu.json", "utf8")));
  menu.dishes[0].updatedAt = "2026-10-08T00:00:00.000Z";
  menu.dishes[1].visible = false;
  menu.dishes[2].available = false;
  const hiddenCategory = menu.categories[3];
  hiddenCategory.visible = false;
  const shown = publicMenu(menu);
  const json = JSON.stringify(shown);
  assert.ok(!json.includes("updatedAt"));
  assert.ok(!shown.dishes.some((d) => d.id === menu.dishes[1].id || d.id === menu.dishes[2].id));
  assert.ok(!shown.categories.some((c) => c.id === hiddenCategory.id));
  assert.ok(!shown.dishes.some((d) => d.section === hiddenCategory.id));
});

test("sign-ins are limited per address and name, and a success clears the count", async () => {
  const dir = mkdtempSync(join(tmpdir(), "sushinaa-limit-"));
  process.env.CMS_DATABASE_URL = `file:${dir}/menu.db`;
  const { db, initDb } = await import("../src/cms/db");
  const { signInWait, recordFailure, clearFailures } = await import("../src/cms/login-limit");
  const fail = (ip: string, name: string, now: number) => db.batch(recordFailure(ip, name, now), "write");
  try {
    await initDb();
    const t = 1_000_000_000;
    for (let i = 0; i < 4; i++) await fail("198.51.100.1", "admin", t);
    assert.equal(await signInWait("198.51.100.1", "admin", t), 0);
    await fail("198.51.100.1", "Admin", t);
    assert.equal(await signInWait("198.51.100.1", "admin", t + 60_000), 840);
    // Another address, or another name from the same address, still gets in.
    assert.equal(await signInWait("198.51.100.2", "admin", t), 0);
    assert.equal(await signInWait("198.51.100.1", "owner", t), 0);
    // The address as a whole stops at 20.
    for (let i = 0; i < 15; i++) await fail("198.51.100.1", `name${i}`, t);
    assert.ok((await signInWait("198.51.100.1", "owner", t)) > 0);
    // The window ends.
    assert.equal(await signInWait("198.51.100.1", "admin", t + 15 * 60_000), 0);
    await fail("198.51.100.3", "admin", t);
    await db.execute(clearFailures("198.51.100.3", "admin"));
    const left = await db.execute("SELECT key FROM login_attempts WHERE key LIKE '%198.51.100.3%'");
    assert.deepEqual(left.rows.map((r) => r.key), ["ip:198.51.100.3"]);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
