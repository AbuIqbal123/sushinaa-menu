import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { withCardPhotos } from "../src/cms/card-photos";
import { menuSchema, type MenuData } from "../src/cms/schema";
import table from "../data/card-photos.json";
import shipped from "../src/cms/static-images.json";
import { staticImages } from "../scripts/static-images";
const seed: MenuData = JSON.parse(
  readFileSync("data/initial-menu.json", "utf8"),
);
// The seed as it was before the card photos: every photo back on its original.
function unswapped(menu: MenuData): MenuData {
  const out = structuredClone(menu);
  for (const dish of out.dishes) {
    const photos: { image?: string; optionsImage?: string }[] = [dish];
    if (dish.kind.type === "roll")
      photos.push(...dish.kind.proteins, ...(dish.kind.style?.options ?? []));
    for (const p of photos)
      if (p.optionsImage && table.cards[p.optionsImage as keyof typeof table.cards]) {
        p.image = p.optionsImage;
        delete p.optionsImage;
      }
    if (dish.imageFocus && table.focus[dish.image as keyof typeof table.focus])
      delete dish.imageFocus;
  }
  return out;
}
test("the seed is the original menu with card photos applied, and applying again changes nothing", () => {
  const before = unswapped(seed);
  const { menu, changed } = withCardPhotos(before);
  assert.deepEqual(menu, seed);
  assert.equal(changed.length, 74);
  assert.deepEqual(withCardPhotos(seed).changed, []);
  assert.ok(menuSchema.safeParse(seed).success);
  const dishes = seed.dishes;
  assert.equal(dishes.filter((d) => d.image.startsWith("/dishes/portrait/")).length, 74);
  assert.equal(dishes.filter((d) => d.imageFocus).length, 0);
  // Approved portraits show the full composition without a focal-point crop.
  for (const d of dishes)
    assert.ok(!(d.imageFocus && d.image.startsWith("/dishes/portrait/")), d.id);
});
test("photos an admin has changed are left alone", () => {
  const before = unswapped(seed);
  const [cropped, extend] = ["gyoza-chicken", "sushinaa-burger"].map(
    (id) => before.dishes.find((d) => d.id === id)!,
  );
  cropped.optionsImage = "/api/media/wide.webp";
  extend.imageFocus = { x: 10, y: 20 };
  const replaced = before.dishes.find((d) => d.id === "crab-rangoon")!;
  replaced.image = "/api/media/new.webp";
  const { menu } = withCardPhotos(before);
  const get = (id: string) => menu.dishes.find((d) => d.id === id)!;
  assert.equal(get("gyoza-chicken").image, "/dishes/gyoza-chicken.jpg");
  assert.equal(get("gyoza-chicken").optionsImage, "/api/media/wide.webp");
  assert.deepEqual(get("sushinaa-burger").imageFocus, { x: 10, y: 20 });
  assert.equal(get("crab-rangoon").image, "/api/media/new.webp");
  assert.equal(get("crab-rangoon").optionsImage, undefined);
  assert.equal(before.dishes.find((d) => d.id === "tiger-roll")!.optionsImage, undefined, "input untouched");
});
test("every card photo and original ships, and the image list matches public/", () => {
  assert.deepEqual(shipped, staticImages(), "Run npm run images:manifest");
  for (const [original, card] of Object.entries(table.cards)) {
    assert.ok(shipped.includes(original), original);
    assert.ok(shipped.includes(card), card);
  }
});

test("existing seeded crops upgrade to portraits without changing full originals", () => {
  const legacy = structuredClone(seed);
  for (const dish of legacy.dishes) {
    const photos: { image?: string; optionsImage?: string }[] = [dish];
    if (dish.kind.type === "roll") photos.push(...dish.kind.proteins, ...(dish.kind.style?.options ?? []));
    for (const photo of photos) if (photo.image) photo.image = photo.image.replace("/portrait/", "/card/");
  }
  const before = structuredClone(legacy);
  const upgraded = withCardPhotos(legacy);
  assert.deepEqual(upgraded.menu, seed);
  assert.equal(upgraded.changed.length, 74);
  assert.deepEqual(withCardPhotos(upgraded.menu).changed, []);
  assert.deepEqual(legacy, before, "stored input remains untouched");
});

test("custom photos paired with seeded originals are not replaced by portraits", () => {
  const custom = structuredClone(seed);
  const dish = custom.dishes.find(d => d.id === "sushinaa-burger")!;
  dish.image = "/api/media/custom-card.webp";
  const roll = custom.dishes.find(d => d.id === "mario-roll")!;
  if (roll.kind.type !== "roll") throw new Error("Expected roll");
  roll.kind.proteins[0].image = "/api/media/custom-protein.webp";
  const original = structuredClone(custom);
  assert.deepEqual(withCardPhotos(custom).menu, original);
  assert.deepEqual(withCardPhotos(custom).changed, []);
});
