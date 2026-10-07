import { unstable_cache } from "next/cache";
import { cache } from "react";
import { db, initDb } from "./db";
import { menuSchema, type MenuSnapshot } from "./schema";
import { menuLimitIssues } from "./limits";
import { ZodError } from "zod";
import shipped from "./static-images.json";
const staticImages = new Set(shipped);
export class ConflictError extends Error {}
export class ContentError extends Error {}
async function validateImages(input: unknown) {
  const paths = new Set<string>();
  function visit(v: unknown) {
    if (Array.isArray(v)) v.forEach(visit);
    else if (v && typeof v === "object")
      for (const [key, value] of Object.entries(v)) {
        if (
          ["image", "optionsImage", "logo", "documentLogo"].includes(key) &&
          typeof value === "string"
        )
          paths.add(value);
        else visit(value);
      }
  }
  visit(input);
  await Promise.all(
    [...paths].map(async (path) => {
      if (path.startsWith("/api/media/")) {
        const result = await db.execute({
          sql: "SELECT id FROM media WHERE id=?",
          args: [path.slice("/api/media/".length)],
        });
        if (!result.rows.length)
          throw new ContentError(`Image does not exist: ${path}`);
      } else if (!staticImages.has(path))
        throw new ContentError(`Image does not exist: ${path}`);
    }),
  );
}

export async function readMenu(): Promise<MenuSnapshot> {
  await initDb();
  const result = await db.execute(
    "SELECT revision,content FROM menu WHERE id=1",
  );
  if (!result.rows[0])
    throw new Error("Menu is not initialised. Run npm run cms:seed.");
  return {
    revision: Number(result.rows[0].revision),
    menu: menuSchema.parse(JSON.parse(String(result.rows[0].content))),
  };
}
export const MENU_CACHE_TAG = "cms-menu";
// Public pages share the last published menu across requests instead of querying
// and re-validating the whole document on every view. Saves invalidate the tag;
// the time limit only bounds staleness on self-hosted multi-instance setups.
export const getMenu = cache(
  unstable_cache(readMenu, [MENU_CACHE_TAG], {
    tags: [MENU_CACHE_TAG],
    revalidate: 300,
  }),
);
export async function saveMenu(
  input: unknown,
  revision: number,
): Promise<MenuSnapshot> {
  const menu = menuSchema.parse(input);
  await initDb();
  // Only new or changed text has to fit; what is already saved stays valid.
  const stored = await readMenu().catch(() => undefined);
  const over = menuLimitIssues(menu, stored?.menu);
  if (over.length) throw new ZodError(over);
  await validateImages(menu);
  const result = await db.execute({
    sql: "UPDATE menu SET content=?,revision=revision+1 WHERE id=1 AND revision=?",
    args: [JSON.stringify(menu), revision],
  });
  if (result.rowsAffected !== 1)
    throw new ConflictError(
      "The menu changed in another session. Reload before saving to avoid overwriting those changes.",
    );
  return { menu, revision: revision + 1 };
}
export async function seedMenu(input: unknown) {
  const menu = menuSchema.parse(input);
  await initDb();
  return db.execute({
    sql: "INSERT OR IGNORE INTO menu (id,revision,content) VALUES (1,1,?)",
    args: [JSON.stringify(menu)],
  });
}
