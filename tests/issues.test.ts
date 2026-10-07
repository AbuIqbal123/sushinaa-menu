import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { fieldErrors } from "../src/cms/issues";
import { dishSchema } from "../src/cms/schema";
test("field errors are keyed by path and written for people", () => {
  const s = z.object({
    a: z.number(),
    b: z.string().min(1),
    c: z.array(z.string()).min(1),
    d: z.string().max(3),
    e: z.url(),
    f: z.string().min(1, "Name is required"),
  });
  const r = s.safeParse({ b: "", c: [], d: "long", e: "nope", f: "" });
  assert.ok(!r.success);
  assert.deepEqual(fieldErrors(r.error.issues), {
    a: "Enter a number.",
    b: "Required.",
    c: "Add at least 1.",
    d: "Keep it to 3 characters or fewer.",
    e: "Enter a full web address, starting with https://.",
    f: "Name is required",
  });
});
test("nested dish issues keep their full path, first message wins", () => {
  const r = dishSchema.safeParse({
    id: "x",
    name: "",
    nameAr: "",
    section: "New",
    description: "",
    image: "",
    imageAlt: "",
    imageAltAr: "",
    tags: [],
    kind: {
      type: "sauce-price",
      sauces: [{ id: "a", name: "", priceQar: -1 }],
    },
    order: 0,
    visible: true,
    available: true,
  });
  assert.ok(!r.success);
  const e = fieldErrors(r.error.issues);
  assert.equal(e.name, "Name is required");
  assert.equal(e.image, "Choose an existing image or upload a photo");
  assert.equal(e["kind.sauces.0.name"], "Name is required");
  assert.equal(e["kind.sauces.0.priceQar"], "Use 0 or more.");
});
