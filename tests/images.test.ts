import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dishSchema, type MenuData } from "../src/cms/schema";
import { imageFor, photoPosition, sheetImageFor } from "../src/ordering/price";
const menu: MenuData = JSON.parse(
  readFileSync("data/initial-menu.json", "utf8"),
);
const burger = menu.dishes.find((d) => d.id === "sushinaa-burger")!;
const roll = menu.dishes.find((d) => d.id === "mario-roll")!;
test("options photo and focal point are optional and range-checked", () => {
  assert.ok(dishSchema.safeParse(burger).success);
  const ok = {
    ...burger,
    optionsImage: "/api/media/abc.webp",
    imageFocus: { x: 0, y: 100 },
  };
  assert.ok(dishSchema.safeParse(ok).success);
  for (const imageFocus of [
    { x: -1, y: 50 },
    { x: 50, y: 100.5 },
    { x: 50 },
    { x: "50", y: 50 },
    { x: 50, y: 50, z: 1 },
  ])
    assert.ok(
      !dishSchema.safeParse({ ...burger, imageFocus }).success,
      JSON.stringify(imageFocus),
    );
  assert.ok(
    !dishSchema.safeParse({
      ...burger,
      optionsImage: "https://example.com/x.jpg",
    }).success,
  );
});
test("card keeps the tall photo; the sheet prefers variant, then options photo", () => {
  const dish = {
    ...burger,
    optionsImage: "/api/media/wide.webp",
    imageFocus: { x: 30, y: 60 },
  };
  assert.equal(imageFor(dish, {}), burger.image);
  assert.equal(sheetImageFor(dish, {}), "/api/media/wide.webp");
  assert.equal(sheetImageFor(burger, {}), burger.image);
  const chicken = { ...roll, optionsImage: "/api/media/wide.webp" };
  assert.equal(
    sheetImageFor(chicken, { protein: "chicken" }),
    "/dishes/mario-roll-chicken.jpg",
  );
  // The focal point belongs to the card photo only.
  assert.equal(photoPosition(dish, dish.image), "30% 60%");
  assert.equal(photoPosition(dish, "/api/media/wide.webp"), undefined);
  assert.equal(photoPosition(burger, burger.image), undefined);
});
