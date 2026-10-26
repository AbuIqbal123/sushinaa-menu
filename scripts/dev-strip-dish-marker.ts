import { assertDevDatabase, assertDevelopmentMarker } from "./dev-database";
import { CONFIRMED_DISH_ID, CONFIRMED_NAME, CONFIRMED_NAME_AR, hasDevMarker } from "./dish-marker";

type Dish = { id: string; name: string; nameAr: string };

assertDevDatabase();

const apply = process.argv.includes("--apply");

async function main() {
  await assertDevelopmentMarker();
  const { db, initDb } = await import("../src/cms/db");
  const { saveMenu } = await import("../src/cms/repository");
  await initDb();

  const row = (await db.execute("SELECT revision, content FROM menu WHERE id=1")).rows[0];
  if (!row) {
    console.error("Refusing to run: menu row is missing.");
    process.exit(1);
  }
  const revision = Number(row.revision);
  const menu = JSON.parse(String(row.content)) as { dishes: Dish[] };
  const matched = menu.dishes.filter((dish) => hasDevMarker(dish.name) || hasDevMarker(dish.nameAr));
  if (matched.length !== 1 || matched[0].id !== CONFIRMED_DISH_ID) {
    console.error("Stop and ask Abubaker. The marker does not match exactly one confirmed dish.");
    for (const dish of matched) console.error(`${dish.id}: ${dish.name} / ${dish.nameAr}`);
    process.exit(1);
  }
  const dish = matched[0];
  console.log(`${dish.id}: ${dish.name} → ${CONFIRMED_NAME}`);
  console.log(`${dish.id}: ${dish.nameAr} → ${CONFIRMED_NAME_AR}`);
  if (!apply) return;
  if (dish.name === CONFIRMED_NAME && dish.nameAr === CONFIRMED_NAME_AR) return;
  dish.name = CONFIRMED_NAME;
  dish.nameAr = CONFIRMED_NAME_AR;
  await saveMenu(menu, revision, { actor: "dev-script", ip: null, userAgent: null });
  console.log("applied");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
