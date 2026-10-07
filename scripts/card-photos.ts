// Points the stored menu at the 9:16 card photos (see src/cms/card-photos.ts).
//   npm run cms:card-photos              dry run: lists what would change
//   npm run cms:card-photos -- --write   saves it as a new menu revision
//   npm run cms:card-photos -- --seed    rewrites data/initial-menu.json
import { readFileSync, writeFileSync } from "node:fs";
import { loadEnvConfig } from "@next/env";
import { withCardPhotos } from "../src/cms/card-photos";
import { menuSchema } from "../src/cms/schema";

async function main() {
  const mode = process.argv[2];
  if (mode === "--seed") {
    const file = "data/initial-menu.json";
    const seed = JSON.parse(readFileSync(file, "utf8"));
    const { menu, changed } = withCardPhotos(seed);
    menuSchema.parse(menu);
    writeFileSync(file, JSON.stringify(menu, null, 2) + "\n");
    console.log(`Seed: ${changed.length} dishes updated.`);
    return;
  }
  loadEnvConfig(process.cwd());
  const { readMenu, saveMenu } = await import("../src/cms/repository");
  const { db } = await import("../src/cms/db");
  try {
    const where = (process.env.CMS_DATABASE_URL ?? "file:").startsWith("file:")
      ? "local file database"
      : "remote database";
    const { menu, revision } = await readMenu();
    const { menu: next, changed } = withCardPhotos(menu);
    console.log(`${where}, revision ${revision}: ${changed.length} dishes to update.`);
    if (changed.length) console.log(changed.join("\n"));
    if (!changed.length || mode !== "--write") return;
    const saved = await saveMenu(next, revision);
    console.log(`Saved as revision ${saved.revision}.`);
  } finally {
    db.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
