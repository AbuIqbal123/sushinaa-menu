import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { MenuData } from "../src/cms/schema";
import { kindLabels, pricingExample } from "../src/components/admin/pricing";
const menu: MenuData = JSON.parse(
  readFileSync("data/initial-menu.json", "utf8"),
);
test("every pricing kind has a real seeded example with its real price", () => {
  for (const type of Object.keys(kindLabels)) {
    const line = pricingExample(type, menu.dishes, "QAR");
    const dish = menu.dishes.find((d) => d.kind.type === type)!;
    assert.ok(dish, type);
    assert.ok(line.includes(dish.name), line);
    assert.match(line, /\d+ QAR/);
  }
  assert.equal(
    pricingExample("simple", menu.dishes, "QAR"),
    "One price. Shrimp kunafa is 35 QAR.",
  );
});
test("the example skips the dish being edited and says when none exists", () => {
  const first = menu.dishes.find((d) => d.kind.type === "simple")!;
  assert.ok(
    !pricingExample("simple", menu.dishes, "QAR", first.id).includes(
      first.name,
    ),
  );
  assert.equal(
    pricingExample("simple", [], "QAR"),
    "No dish on the menu is priced this way yet.",
  );
});
