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
test("the card shows the card photo; the sheet shows the full photo behind it", () => {
  const plain = { ...burger, optionsImage: undefined, imageFocus: undefined };
  assert.equal(imageFor(plain, {}), burger.image);
  assert.equal(sheetImageFor(plain, {}), burger.image);
  const upload = { ...plain, optionsImage: "/api/media/wide.webp" };
  assert.equal(sheetImageFor(upload, {}), "/api/media/wide.webp");
  // A roll variant brings its own pair, never the dish's full photo.
  const chicken = { protein: "chicken" };
  assert.equal(imageFor(roll, chicken), "/dishes/card/mario-roll-chicken.webp");
  assert.equal(sheetImageFor(roll, chicken), "/dishes/mario-roll-chicken.jpg");
  const proteins = roll.kind.type === "roll" ? roll.kind.proteins : [];
  const uploaded = {
    ...roll,
    optionsImage: "/api/media/wide.webp",
    kind: {
      ...roll.kind,
      proteins: proteins.map((p) => ({
        ...p,
        image: "/api/media/new.webp",
        optionsImage: undefined,
      })),
    },
  } as typeof roll;
  assert.equal(sheetImageFor(uploaded, chicken), "/api/media/new.webp");
});
test("the focal point applies to the dish's own card photo only", () => {
  const dish = { ...burger, optionsImage: "/api/media/wide.webp", imageFocus: { x: 17.3, y: 50 } };
  assert.equal(photoPosition(dish, dish.image), "17.3% 50%");
  assert.equal(photoPosition(dish, "/api/media/wide.webp"), undefined);
  assert.equal(
    photoPosition({ ...dish, imageFocus: undefined }, dish.image),
    undefined,
  );
});
