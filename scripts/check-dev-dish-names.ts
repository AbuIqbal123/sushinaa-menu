import { assertDevDatabase, assertDevelopmentMarker } from "./dev-database";
import { hasDevMarker } from "./dish-marker";

assertDevDatabase();

async function main() {
  await assertDevelopmentMarker();
  const { db, initDb } = await import("../src/cms/db");
  await initDb();
  const row = (await db.execute("SELECT content FROM menu WHERE id=1")).rows[0];
  if (!row) {
    console.error("Menu row is missing.");
    process.exit(1);
  }
  const menu = JSON.parse(String(row.content)) as { dishes: { id: string; name: string; nameAr: string }[] };
  const flagged = menu.dishes.filter((dish) => hasDevMarker(dish.name) || hasDevMarker(dish.nameAr));
  if (flagged.length) {
    for (const dish of flagged) console.error(`${dish.id}: ${dish.name} / ${dish.nameAr}`);
    process.exit(1);
  }
  console.log("ok");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
