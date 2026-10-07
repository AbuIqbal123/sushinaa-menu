import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fillIds, slugify, uniqueId } from "../src/cms/ids";
import { menuSchema } from "../src/cms/schema";

test("ids come from the English name and stay unique", () => {
  assert.equal(slugify("Sushinaa Burger (Spicy!)"), "sushinaa-burger-spicy");
  assert.equal(slugify("Crème brûlée"), "creme-brulee");
  assert.equal(uniqueId("Gyoza beef", ["gyoza-beef"]), "gyoza-beef-2");
  assert.equal(
    uniqueId("Gyoza beef", ["gyoza-beef", "gyoza-beef-2"]),
    "gyoza-beef-3",
  );
  assert.match(uniqueId("برجر", []), /^item-[0-9a-f]{6}$/);
});

test("fillIds only names new entries and leaves existing ids alone", () => {
  const kind = {
    type: "roll",
    proteins: [
      { id: "chicken", name: "Chicken (renamed)" },
      { id: "", name: "Chicken" },
      { id: "", name: "Chicken" },
    ],
  };
  const out = fillIds(kind);
  assert.deepEqual(
    out.proteins.map((p) => p.id),
    ["chicken", "chicken-2", "chicken-3"],
  );
  assert.equal(kind.proteins[1].id, "", "input is not mutated");
});

test("seed data passes through fillIds unchanged and still validates", () => {
  const seed = JSON.parse(readFileSync("data/initial-menu.json", "utf8"));
  assert.deepEqual(fillIds(seed), seed);
  assert.ok(menuSchema.safeParse(seed).success);
});
