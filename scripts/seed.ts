import { readFileSync } from "node:fs";
import { loadEnvConfig } from "@next/env";
async function main() {
  loadEnvConfig(process.cwd());
  const { seedMenu, readMenu } = await import("../src/cms/repository");
  const { db } = await import("../src/cms/db");
  try {
    const result = await seedMenu(
      JSON.parse(readFileSync("data/initial-menu.json", "utf8")),
    );
    const { menu } = await readMenu();
    console.log(
      result.rowsAffected
        ? "Seeded original menu."
        : "Existing menu preserved.",
      menu.categories.length,
      "categories,",
      menu.dishes.length,
      "dishes.",
    );
  } finally {
    db.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
