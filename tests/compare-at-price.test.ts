import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { menuSchema } from "../src/cms/schema";
import {
  defaultSelection,
  shownLeaf,
  shownPrice,
  unitPrice,
} from "../src/ordering/price";
import type { Dish } from "../src/catalog/types";

const seed = menuSchema.parse(
  JSON.parse(readFileSync("data/initial-menu.json", "utf8")),
);

test("shownPrice charge matches unitPrice and sale lowers the charge", () => {
  const dish = seed.dishes.find((d) => d.kind.type === "simple")!;
  const onSale = structuredClone(dish) as Dish;
  assert.equal(onSale.kind.type, "simple");
  onSale.kind = { type: "simple", priceQar: 40, saleQar: 32 };
  const sel = defaultSelection(onSale);
  assert.equal(unitPrice(onSale, sel), 32);
  assert.deepEqual(shownPrice(onSale, sel), { chargeQar: 32, wasQar: 40 });
  assert.equal(shownPrice(onSale, sel).chargeQar, unitPrice(onSale, sel));
});

test("shownPrice folds base and extra sales", () => {
  const dish = seed.dishes.find(
    (d) => d.kind.type === "simple" && (d.extras?.length ?? 0) > 0,
  );
  const base = dish ?? seed.dishes.find((d) => d.kind.type === "simple")!;
  const onSale = structuredClone(base) as Dish;
  assert.equal(onSale.kind.type, "simple");
  onSale.kind = { type: "simple", priceQar: 30, saleQar: 20 };
  onSale.extras = [
    { id: "x1", name: "Extra", priceQar: 8, saleQar: 5 },
  ];
  const sel = { ...defaultSelection(onSale), extras: ["x1"] };
  assert.equal(unitPrice(onSale, sel), 25);
  assert.deepEqual(shownPrice(onSale, sel), { chargeQar: 25, wasQar: 38 });
});

test("shownLeaf hides a sale that is not lower", () => {
  assert.deepEqual(shownLeaf(32, 32), { chargeQar: 32, wasQar: null });
  assert.deepEqual(shownLeaf(40, 32), { chargeQar: 32, wasQar: 40 });
  assert.deepEqual(shownLeaf(32), { chargeQar: 32, wasQar: null });
});
