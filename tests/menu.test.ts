import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { menuSchema, normalizeStoredMenu, publicMenu } from "../src/cms/schema";
import {
  defaultSelection,
  isSelectionComplete,
  unitPrice,
  imageFor,
  selectionLabel,
} from "../src/ordering/price";
import { strings } from "../src/i18n/copy";
import { withCardPhotos } from "../src/cms/card-photos";
const original = JSON.parse(
  readFileSync("tests/fixtures/original-menu.json", "utf8"),
);
const seed = menuSchema.parse(
  JSON.parse(readFileSync("data/initial-menu.json", "utf8")),
);
function contains(actual: unknown, expected: unknown, path = "menu") {
  if (Array.isArray(expected)) {
    assert.ok(Array.isArray(actual), path);
    assert.equal(actual.length, expected.length, path);
    expected.forEach((v, i) => contains(actual[i], v, `${path}.${i}`));
  } else if (expected && typeof expected === "object") {
    for (const [k, v] of Object.entries(expected))
      contains((actual as Record<string, unknown>)[k], v, `${path}.${k}`);
  } else assert.deepEqual(actual, expected, path);
}
test("all 74 original dishes, nested options, prices, descriptions and images are preserved exactly", () => {
  assert.equal(seed.dishes.length, 74);
  // Photos moved to their 9:16 card crops; the originals stay as full photos.
  contains(seed.dishes, withCardPhotos(original).menu.dishes);
  assert.deepEqual(
    seed.categories.map((c) => ({ id: c.id, label: c.name })),
    original.categories,
  );
  assert.deepEqual(
    publicMenu(seed).dishes.map((d) => d.id),
    original.dishes.map((d: { id: string }) => d.id),
  );
  const walk = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object")
      for (const [k, x] of Object.entries(v)) {
        if (k === "image" || k === "optionsImage") assert.ok(existsSync("public" + x), String(x));
        else walk(x);
      }
  };
  walk(seed.dishes);
});
test("English and Arabic wording and interpolations preserve existing copy", () => {
  assert.deepEqual(
    seed.copy,
    JSON.parse(readFileSync("tests/fixtures/original-copy.json", "utf8")),
  );
  for (const lang of ["en", "ar"] as const) {
    const t = strings(lang, seed.copy);
    assert.ok(!t.openDetails("Dish").includes("{0}"));
    assert.ok(t.ofCount(2, 3).includes("2"));
    assert.ok(t.openOrder(0));
  }
  assert.equal(
    seed.dishes.find((d) => d.id === "tempura-roll")?.kind.type,
    "roll",
  );
});
test("older stored menus drop retired copy keys and gain Arabic delivery areas", () => {
  const raw = structuredClone(seed) as {
    copy: { en: Record<string, string>; ar: Record<string, string> };
    settings: { areasAr?: string[] };
  };
  for (const lang of ["en", "ar"] as const) {
    raw.copy[lang].inOrderZero = "old";
    raw.copy[lang].inOrderOne = "old";
    raw.copy[lang].inOrderOther = "old";
  }
  delete raw.settings.areasAr;
  delete raw.copy.en.categoryHint;
  delete raw.copy.ar.categoryHint;
  const parsed = menuSchema.parse(normalizeStoredMenu(raw));
  assert.equal("inOrderZero" in parsed.copy.en, false);
  assert.equal("inOrderOther" in parsed.copy.ar, false);
  assert.equal(parsed.copy.en.categoryHint, "Tap here for categories");
  assert.equal(parsed.copy.ar.categoryHint, "اضغط هنا للتصنيفات");
  assert.deepEqual(parsed.settings.areasAr, [
    "داون تاون",
    "أسباير",
    "الخور",
    "سيلين",
    "نعيجة",
  ]);
});
test("all original pricing models retain valid defaults and configurable pricing", () => {
  assert.equal(new Set(seed.dishes.map((d) => d.kind.type)).size, 8);
  for (const dish of seed.dishes) {
    const sel = defaultSelection(dish);
    assert.ok(Number.isFinite(unitPrice(dish, sel)), dish.id);
    assert.ok(imageFor(dish, sel));
    if (dish.kind.type === "party-box")
      sel.starters = Array(dish.kind.starterMin).fill(dish.kind.starters[0].id);
    if (dish.kind.type === "addons" && dish.kind.includedPicks)
      sel.picks = Array(dish.kind.includedPicks.min).fill(
        dish.kind.includedPicks.options[0].id,
      );
    assert.ok(isSelectionComplete(dish, sel), dish.id);
    selectionLabel(dish, sel, "ar", strings("ar", seed.copy));
  }
});
test("validation rejects invalid money, relationships, empty choices, limits and duplicate IDs", () => {
  const invalid = (change: (m: typeof seed) => void) => {
    const m = structuredClone(seed);
    change(m);
    assert.equal(menuSchema.safeParse(m).success, false);
  };
  invalid((m) => {
    m.dishes[0].name = "";
  });
  invalid((m) => {
    m.dishes[0].section = "missing";
  });
  invalid((m) => {
    m.dishes[0].kind = { type: "simple", priceQar: -1 };
  });
  invalid((m) => {
    m.dishes[0].kind = { type: "simple", priceQar: 1.234 };
  });
  invalid((m) => {
    m.dishes[0].kind = { type: "roll", proteins: [] };
  });
  invalid((m) => {
    m.dishes[0].kind = {
      type: "party-box",
      priceQar: 10,
      starterMin: 3,
      starterMax: 2,
      starters: [{ id: "a", name: "A" }],
    };
  });
  invalid((m) => {
    m.categories.push(m.categories[0]);
  });
  invalid((m) => {
    m.dishes[0].image = "javascript:alert(1)";
  });
  invalid((m) => {
    m.dishes[0].image = "/dishes/../private";
  });
});
test("visibility, availability and explicit ordering determine the public menu", () => {
  const m = structuredClone(seed);
  m.categories[0].visible = false;
  m.dishes[8].available = false;
  m.dishes[9].visible = false;
  const result = publicMenu(m);
  assert.ok(
    !result.dishes.some(
      (d) =>
        d.section === m.categories[0].id ||
        d.id === m.dishes[8].id ||
        d.id === m.dishes[9].id,
    ),
  );
  m.categories[0].visible = true;
  m.categories[0].order = 100;
  assert.notEqual(publicMenu(m).categories[0].id, m.categories[0].id);
});
test("deleted option IDs in saved carts are rejected", () => {
  const d = seed.dishes.find((d) => d.kind.type === "deal-box")!;
  assert.equal(
    isSelectionComplete(d, { starter: "deleted", sushi: "deleted" }),
    false,
  );
  const g = seed.dishes.find(
    (d) => d.kind.type === "addons" && d.kind.includedPicks,
  )!;
  assert.equal(isSelectionComplete(g, { picks: ["bad", "bad"] }), false);
});
