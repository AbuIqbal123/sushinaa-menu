import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { menuSchema, type MenuData } from "../src/cms/schema";
import {
  characters,
  dishLimitIssues,
  LIMITS,
  menuLimitIssues,
} from "../src/cms/limits";
const seed: MenuData = menuSchema.parse(
  JSON.parse(readFileSync("data/initial-menu.json", "utf8")),
);
const burger = seed.dishes.find((d) => d.id === "sushinaa-burger")!;
test("every seeded name, description and option fits the limits", () => {
  assert.deepEqual(menuLimitIssues(seed), []);
});
test("new or changed text over a limit is refused at its own field", () => {
  const long = {
    ...burger,
    name: "x".repeat(LIMITS.name.en + 1),
    descriptionAr: "ع".repeat(LIMITS.description.ar + 1),
  };
  assert.deepEqual(
    dishLimitIssues(long, burger).map((i) => [i.path.join("."), i.message]),
    [
      ["name", `Keep it to ${LIMITS.name.en} characters or fewer.`],
      ["descriptionAr", `Keep it to ${LIMITS.description.ar} characters or fewer.`],
    ],
  );
  const option = structuredClone(burger);
  if (option.kind.type !== "addons") throw new Error("burger has add-ons");
  option.kind.extras[0].nameAr = "ع".repeat(LIMITS.option.ar + 1);
  assert.deepEqual(
    dishLimitIssues(option, burger).map((i) => i.path.join(".")),
    ["kind.extras.0.nameAr"],
  );
  // Exactly at the limit is fine; characters count as people see them.
  assert.deepEqual(dishLimitIssues({ ...burger, name: "x".repeat(LIMITS.name.en) }), []);
  assert.equal(characters("🍣🍣"), 2);
});
test("text already saved over a limit stays valid until it changes", () => {
  const stored = structuredClone(seed);
  stored.dishes[0].name = "x".repeat(LIMITS.name.en + 5);
  assert.deepEqual(menuLimitIssues(stored, stored), []);
  const edited = structuredClone(stored);
  edited.dishes[0].name += "y";
  assert.deepEqual(
    menuLimitIssues(edited, stored).map((i) => i.path.join(".")),
    ["dishes.0.name"],
  );
  edited.categories[1].nameAr = "ع".repeat(LIMITS.category.ar + 1);
  assert.deepEqual(
    menuLimitIssues(edited, stored).map((i) => i.path.join(".")),
    ["dishes.0.name", "categories.1.nameAr"],
  );
});
