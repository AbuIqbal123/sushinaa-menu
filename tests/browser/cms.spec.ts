import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { MenuSnapshot } from "../../src/cms/schema";
import { admin } from "./admin";
test("authenticated CMS CRUD, persistence, uploads and public integration", async ({
  page,
  request,
  baseURL,
}) => {
  const origin = baseURL!;
  const headers = { Origin: origin };
  expect((await request.get("/api/admin/menu")).status()).toBe(401);
  expect(
    (await request.put("/api/admin/menu", { headers, data: {} })).status(),
  ).toBe(401);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.getByLabel("Username").fill(admin.username);
  await page.getByLabel("Password", { exact: true }).fill(`wrong-${Date.now()}`);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  // Next also renders an empty role="alert" route announcer; match the sign-in error only.
  await expect(page.getByRole("alert").filter({ hasText: "Invalid" })).toBeVisible();
  await page.getByLabel("Password", { exact: true }).fill(admin.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible();
  const api = page.request;
  let snapshot: MenuSnapshot = await (await api.get("/api/admin/menu")).json();
  const backup = structuredClone(snapshot.menu);
  async function publish() {
    const r = await api.put("/api/admin/menu", { headers, data: snapshot });
    expect(r.status(), await r.text()).toBe(200);
    snapshot = await r.json();
  }
  try {
    expect(
      (
        await api.put("/api/admin/menu", {
          headers: { Origin: "https://evil.example" },
          data: snapshot,
        })
      ).status(),
    ).toBe(403);
    const bad = structuredClone(snapshot);
    bad.menu.dishes[0].name = "";
    expect(
      (await api.put("/api/admin/menu", { headers, data: bad })).status(),
    ).toBe(422);
    await page.getByRole("button", { name: "Categories", exact: true }).click();
    await page
      .getByRole("button", { name: "Add category", exact: true })
      .click();
    await page
      .getByLabel("Name (English)", { exact: true })
      .fill("Test category");
    await page.getByLabel("Name (Arabic)", { exact: true }).fill("اختبار");
    await page
      .getByRole("button", { name: "Save category", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    snapshot = await (await api.get("/api/admin/menu")).json();
    const cat = snapshot.menu.categories.find(
      (c) => c.name === "Test category",
    )!;
    expect(cat).toBeTruthy();
    expect(cat.id).toBe("test-category");
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await page
      .getByRole("button", { name: "Add item", exact: true })
      .first()
      .click();
    await page.getByLabel("Name (English)", { exact: true }).fill("Test dish");
    await page.getByLabel("Name (Arabic)", { exact: true }).fill("طبق");
    await page
      .getByRole("combobox", { name: "Category", exact: true })
      .selectOption(cat.id);
    await page
      .getByLabel("Description (English)", { exact: true })
      .fill("CMS description");
    await page.getByRole("tab", { name: "Images", exact: true }).click();
    await page
      .getByLabel("Card photo (tall)", { exact: true })
      .setInputFiles("public/dishes/sushinaa-burger.jpg");
    await expect(page.locator("dialog[open] .admin-image img")).toHaveAttribute(
      "src",
      /^\/api\/media\//,
    );
    await page.getByRole("tab", { name: "Options", exact: true }).click();
    await page.getByLabel("Base price", { exact: true }).fill("12.5");
    await page.getByRole("button", { name: "Save item", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    snapshot = await (await api.get("/api/admin/menu")).json();
    const dish = snapshot.menu.dishes.find((d) => d.name === "Test dish")!;
    expect(dish).toBeTruthy();
    expect(dish.image).toMatch(/^\/api\/media\//);
    expect(dish.id).toBe("test-dish");
    const upload = await api.post("/api/admin/media", {
      headers,
      multipart: {
        file: {
          name: "photo.jpg",
          mimeType: "image/jpeg",
          buffer: readFileSync("public/dishes/sushinaa-burger.jpg"),
        },
      },
    });
    expect(upload.status()).toBe(200);
    dish.image = (await upload.json()).url;
    expect((await api.get(dish.image)).headers()["content-type"]).toBe(
      "image/webp",
    );
    dish.description = "Changed description";
    dish.kind = {
      type: "addons",
      priceQar: 19.5,
      extras: [
        { id: "test-extra", name: "Extra", nameAr: "إضافة", priceQar: 2.5 },
      ],
      includedPicks: {
        name: "Sauces",
        nameAr: "صوصات",
        min: 1,
        max: 2,
        options: [{ id: "sauce", name: "Sauce" }],
      },
    };
    const oldRevision = snapshot.revision;
    await publish();
    expect(
      (
        await api.put("/api/admin/menu", {
          headers,
          data: { ...snapshot, revision: oldRevision },
        })
      ).status(),
    ).toBe(409);
    snapshot = await (await api.get("/api/admin/menu")).json();
    expect(
      snapshot.menu.dishes.find((d) => d.id === dish.id)?.description,
    ).toBe("Changed description");
    let pub: MenuSnapshot = await (await request.get("/api/menu")).json();
    expect(pub.menu.dishes.find((d) => d.id === dish.id)?.image).toBe(
      dish.image,
    );
    const idx = snapshot.menu.categories.findIndex((c) => c.id === cat.id);
    const firstOrder = snapshot.menu.categories[0].order;
    snapshot.menu.categories[0].order = snapshot.menu.categories[idx].order;
    snapshot.menu.categories[idx].order = firstOrder;
    await publish();
    pub = await (await request.get("/api/menu")).json();
    expect(pub.menu.categories[0].id).toBe(cat.id);
    await page.goto("/down-town");
    const categoryMenu = page.getByRole("button", { name: /^Category:/ });
    await categoryMenu.click();
    const categories = page.getByRole("dialog", { name: "Menu" });
    await categories.getByRole("button", { name: "Test category" }).click();
    await expect(categories).toHaveCount(0);
    await expect(categoryMenu).toHaveAccessibleName("Category: Test category");
    await expect(page.locator("#dish-" + dish.id)).toHaveClass(/is-active/);
    await page
      .locator("#dish-" + dish.id)
      .getByRole("button")
      .click();
    await expect(page.getByRole("dialog")).toContainText("Changed description");
    await expect(page.getByRole("dialog")).toContainText("19.50");
    await expect(page.getByRole("dialog")).toContainText("Extra");
    const current = snapshot.menu.dishes.find((d) => d.id === dish.id)!;
    current.visible = false;
    await publish();
    expect(
      (await (await request.get("/api/menu")).json()).menu.dishes.some(
        (d: { id: string }) => d.id === dish.id,
      ),
    ).toBe(false);
    snapshot.menu.dishes.find((d) => d.id === dish.id)!.visible = true;
    snapshot.menu.dishes.find((d) => d.id === dish.id)!.available = false;
    await publish();
    expect(
      (await (await request.get("/api/menu")).json()).menu.dishes.some(
        (d: { id: string }) => d.id === dish.id,
      ),
    ).toBe(false);
    snapshot.menu.dishes.find((d) => d.id === dish.id)!.available = true;
    snapshot.menu.categories.find((c) => c.id === cat.id)!.visible = false;
    await publish();
    expect(
      (await (await request.get("/api/menu")).json()).menu.categories.some(
        (c: { id: string }) => c.id === cat.id,
      ),
    ).toBe(false);
    snapshot.menu.dishes = snapshot.menu.dishes.filter((d) => d.id !== dish.id);
    snapshot.menu.categories = snapshot.menu.categories.filter(
      (c) => c.id !== cat.id,
    );
    await publish();
    const invalidImage = await api.post("/api/admin/media", {
      headers,
      multipart: {
        file: {
          name: "bad.png",
          mimeType: "image/png",
          buffer: Buffer.from("not an image"),
        },
      },
    });
    expect(invalidImage.status()).toBe(422);
  } finally {
    snapshot = await (await api.get("/api/admin/menu")).json();
    snapshot.menu = backup;
    await publish();
  }
  await page.goto("/admin");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/login/);
  expect((await api.get("/api/admin/menu")).status()).toBe(401);
});
test("public menu works at mobile and desktop widths in both languages", async ({
  page,
}) => {
  // Start every visit with an empty order. Clearing storage from the test
  // races the cart's own writes; clearing before any page script runs can't.
  await page.addInitScript(() => localStorage.clear());
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/down-town");
    await expect(page.locator(".chrome-header")).toBeVisible();
    await expect(page.locator("#dish-sushinaa-burger")).toBeVisible();
    await page.locator("#dish-sushinaa-burger .slide-hit").click();
    await expect(page.getByRole("dialog")).toContainText("Sushinaa burger");
    await page.getByRole("button", { name: /Save item ·/ }).click();
    await expect(page.locator(".sticky-cta")).toContainText("53");
    await page.locator(".sticky-cta").click();
    await expect(page.getByRole("dialog")).toContainText("Sushinaa burger");
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await page.getByRole("button", { name: "Switch to Arabic" }).click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("#dish-sushinaa-burger")).toContainText(
      "برجر سوشينا",
    );
    await page.getByRole("button", { name: "التبديل إلى الإنجليزية" }).click();
  }
});

test("admin controls edit, reorder and delete content and options", async ({
  page,
  baseURL,
}) => {
  const headers = { Origin: baseURL! };
  await page.request.post("/api/admin/session", {
    headers,
    data: admin,
  });
  const original: MenuSnapshot = await (
    await page.request.get("/api/admin/menu")
  ).json();
  async function saved() {
    return (await (
      await page.request.get("/api/admin/menu")
    ).json()) as MenuSnapshot;
  }
  page.on("dialog", (d) => d.accept());
  try {
    await page.goto("/admin");
    await page.getByRole("button", { name: "Categories", exact: true }).click();
    const row = page
      .locator(".admin-row")
      .filter({ has: page.locator("strong", { hasText: /^Starters$/ }) });
    await row.getByRole("button", { name: "Edit", exact: true }).click();
    await page
      .getByLabel("Name (English)", { exact: true })
      .fill("Starter selection");
    await page
      .getByRole("button", { name: "Save category", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(
      (await saved()).menu.categories.find((c) => c.id === "Starters")?.name,
    ).toBe("Starter selection");
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await page
      .getByRole("button", { name: "Move Sushinaa burger down", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (await saved()).menu.dishes
            .filter((d) => d.section === "New")
            .sort((a, b) => a.order - b.order)[0].id,
      )
      .toBe("crispy-calamari");
    const burger = page.locator(".admin-row").filter({
      has: page.locator("strong", { hasText: /^Sushinaa burger$/ }),
    });
    await burger.getByRole("button", { name: "Edit", exact: true }).click();
    await page.getByRole("tab", { name: "Options", exact: true }).click();
    await page.getByLabel("Base price", { exact: true }).fill("54");
    await page
      .getByLabel("Additional price", { exact: true })
      .first()
      .fill("6");
    await page
      .getByRole("button", { name: "Move Spicy mayo down", exact: true })
      .click();
    await page.getByRole("button", { name: "Save item", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const changed = (await saved()).menu.dishes.find(
      (d) => d.id === "sushinaa-burger",
    )!;
    expect(changed.kind.type).toBe("addons");
    if (changed.kind.type === "addons") {
      expect(changed.kind.priceQar).toBe(54);
      expect(changed.kind.extras[1].priceQar).toBe(6);
      expect(changed.kind.extras[1].name).toBe("Spicy mayo");
    }
    expect(changed.image).toBe("/dishes/card/sushinaa-burger.webp");
    const mario = page.locator(".admin-row").filter({
      has: page.locator("strong", { hasText: /^Mario roll$/ }),
    });
    await mario.getByRole("button", { name: "Edit", exact: true }).click();
    await page.getByRole("tab", { name: "Options", exact: true }).click();
    await page
      .locator(".admin-list-entry")
      .first()
      .getByRole("button", { name: "Remove", exact: true })
      .click();
    await page.getByRole("button", { name: "Save item", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const roll = (await saved()).menu.dishes.find(
      (d) => d.id === "mario-roll",
    )!;
    expect(roll.image).toBe("/dishes/card/mario-roll-chicken.webp");
    expect(roll.optionsImage).toBe("/dishes/mario-roll-chicken.jpg");
    if (roll.kind.type === "roll") {
      expect(roll.kind.proteins[0].image).toBeUndefined();
      expect(roll.kind.proteins[1].image).toBeTruthy();
    }
    await burger.getByRole("button", { name: "Edit", exact: true }).click();
    await page.getByRole("tab", { name: "Options", exact: true }).click();
    await page
      .locator(".admin-list-entry")
      .first()
      .getByRole("button", { name: "Delete", exact: true })
      .click();
    await page.getByRole("button", { name: "Save item", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await burger.getByRole("button", { name: "Hide", exact: true }).click();
    await expect
      .poll(
        async () =>
          (await saved()).menu.dishes.find((d) => d.id === "sushinaa-burger")
            ?.visible,
      )
      .toBe(false);
    await burger.getByRole("button", { name: "Show", exact: true }).click();
    await expect
      .poll(
        async () =>
          (await saved()).menu.dishes.find((d) => d.id === "sushinaa-burger")
            ?.visible,
      )
      .toBe(true);
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByRole("tab", { name: "Menu wording", exact: true }).click();
    await page.getByLabel("Find wording").fill("addToOrder");
    await page
      .getByRole("textbox", { name: "English", exact: true })
      .fill("Add this dish");
    await page
      .getByRole("button", { name: "Save settings", exact: true })
      .click();
    await expect
      .poll(async () => (await saved()).menu.copy.en.addToOrder)
      .toBe("Add this dish");
    await page.goto("/down-town");
    await expect(page.locator("#dish-sushinaa-burger .slide-cta")).toHaveText(
      "Add this dish",
    );
    await page.goto("/admin");
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await page
      .locator(".admin-row")
      .filter({ has: page.locator("strong", { hasText: /^Sushinaa burger$/ }) })
      .getByRole("button", { name: "Delete", exact: true })
      .click();
    await expect
      .poll(async () =>
        (await saved()).menu.dishes.some((d) => d.id === "sushinaa-burger"),
      )
      .toBe(false);
    const empty = await saved();
    empty.menu.dishes = [];
    empty.menu.categories = [];
    expect(
      (
        await page.request.put("/api/admin/menu", { headers, data: empty })
      ).status(),
    ).toBe(200);
    await page.goto("/down-town");
    await expect(
      page.getByText("No dishes match these filters."),
    ).toBeVisible();
  } finally {
    const current = await saved();
    const r = await page.request.put("/api/admin/menu", {
      headers,
      data: { revision: current.revision, menu: original.menu },
    });
    expect(r.status()).toBe(200);
  }
});
test("menu filters combine and survive a reload through the URL", async ({
  page,
  baseURL,
}) => {
  await page.request.post("/api/admin/session", {
    headers: { Origin: baseURL! },
    data: admin,
  });
  const rows = page.locator(".admin-group .admin-row");
  await page.goto("/admin?category=Starters&show=active&q=shrimp");
  await expect(page.getByRole("heading", { name: "Your menu" })).toBeVisible();
  await expect(page.getByLabel("Search menu")).toHaveValue("shrimp");
  await expect(page.getByLabel("Filter by category")).toHaveValue("Starters");
  await expect(page.locator(".admin-group")).toHaveCount(1);
  const filtered = await rows.count();
  expect(filtered).toBeGreaterThan(0);
  await page.getByLabel("Search menu").fill("");
  await expect(page).toHaveURL(/\?category=Starters&show=active$/);
  expect(await rows.count()).toBeGreaterThanOrEqual(filtered);
  await page.getByLabel("Filter by category").selectOption("");
  await page.getByLabel("Filter by visibility").selectOption("");
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/admin?category=nope&show=bogus");
  await expect(page.getByLabel("Filter by category")).toHaveValue("");
  await expect(page.getByLabel("Filter by visibility")).toHaveValue("");
  await expect(page.locator(".admin-group").first()).toBeVisible();
  await page.getByLabel("Search menu").fill("no dish is called this");
  await expect(page.locator(".admin-group")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Clear search and filters", exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin$/);
});
test("unsaved edits are guarded and focus returns to the opener", async ({
  page,
  baseURL,
}) => {
  await page.request.post("/api/admin/session", {
    headers: { Origin: baseURL! },
    data: admin,
  });
  const prompts: string[] = [];
  let answer = false;
  page.on("dialog", async (d) => {
    prompts.push(d.type());
    await (answer ? d.accept() : d.dismiss());
  });
  await page.goto("/admin?q=burger");
  const edit = page
    .locator(".admin-row")
    .first()
    .getByRole("button", { name: "Edit", exact: true });
  // A clean editor closes without asking, and focus goes back to "Edit".
  await edit.click();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(edit).toBeFocused();
  expect(prompts).toEqual([]);
  // A dirty editor asks first; declining keeps the edit.
  await edit.click();
  await page.getByLabel("Name (English)").fill("Changed name");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel("Name (English)")).toHaveValue("Changed name");
  expect(prompts).toEqual(["confirm"]);
  answer = true;
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // Unsaved settings block in-app navigation and warn before unload.
  answer = false;
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Tagline").fill("Unsaved tagline");
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  expect(prompts).toEqual(["confirm", "confirm", "confirm"]);
  await page.close({ runBeforeUnload: true });
  await expect.poll(() => prompts.at(-1)).toBe("beforeunload");
});
test("blocked saves show plain errors next to the fields", async ({
  page,
  baseURL,
}) => {
  await page.request.post("/api/admin/session", {
    headers: { Origin: baseURL! },
    data: admin,
  });
  page.on("dialog", (d) => d.accept());
  await page.goto("/admin");
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page
    .getByRole("button", { name: "Add item", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Save item", exact: true }).click();
  const name = page.getByLabel("Name (English)", { exact: true });
  await expect(name).toHaveAttribute("aria-invalid", "true");
  await expect(name).toBeFocused();
  await expect(
    page.locator(".admin-field .admin-field-error").first(),
  ).toHaveText("Name is required");
  await expect(page.locator(".admin-dialog-foot")).toContainText(
    "Fix 2 marked fields in Details and Images.",
  );
  await name.fill("Valid name");
  await expect(name).not.toHaveAttribute("aria-invalid");
  await page.getByRole("tab", { name: "Images", exact: true }).click();
  await expect(page.locator(".admin-field .admin-field-error")).toHaveText(
    "Choose an existing image or upload a photo",
  );
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByText("All changes saved")).toBeVisible();
  const url = page.getByLabel("Website address", { exact: true });
  await url.fill("not a url");
  await expect(page.getByText("Unsaved changes")).toBeVisible();
  await page
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  await expect(url).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator(".admin-field .admin-field-error")).toHaveText(
    "Enter a full web address, starting with https://.",
  );
});
test("changing how an item is priced explains itself and confirms inline", async ({
  page,
  baseURL,
}) => {
  await page.request.post("/api/admin/session", {
    headers: { Origin: baseURL! },
    data: admin,
  });
  const prompts: string[] = [];
  page.on("dialog", (d) => {
    prompts.push(d.message());
    void d.accept();
  });
  await page.goto("/admin?q=sushinaa%20burger");
  await page
    .locator(".admin-row")
    .first()
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  await page.getByRole("tab", { name: "Options", exact: true }).click();
  const priced = page.getByRole("combobox", { name: "How it’s priced" });
  await expect(priced).toHaveValue("addons");
  await expect(page.locator(".admin-hint")).toContainText("QAR");
  await priced.selectOption("simple");
  const confirm = page.locator(".admin-confirm");
  await expect(confirm).toContainText("Switching to Fixed price");
  await expect(page.locator(".admin-hint")).toHaveText(
    "One price. Shrimp kunafa is 35 QAR.",
  );
  await expect(page.getByText("Paid add-ons")).toBeVisible();
  await confirm
    .getByRole("button", { name: "Keep current", exact: true })
    .click();
  await expect(priced).toHaveValue("addons");
  await expect(confirm).toHaveCount(0);
  await priced.selectOption("simple");
  await confirm.getByRole("button", { name: "Switch", exact: true }).click();
  await expect(priced).toHaveValue("simple");
  await expect(page.getByText("Paid add-ons")).toHaveCount(0);
  expect(prompts).toEqual([]);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  expect(prompts).toEqual(["Discard unsaved changes?"]);
});
test("card focal point and options photo round-trip to the public menu", async ({
  page,
  baseURL,
}) => {
  const headers = { Origin: baseURL! };
  await page.request.post("/api/admin/session", {
    headers,
    data: admin,
  });
  const original: MenuSnapshot = await (
    await page.request.get("/api/admin/menu")
  ).json();
  try {
    await page.goto("/admin?q=sushinaa%20burger");
    await page
      .locator(".admin-row")
      .first()
      .getByRole("button", { name: "Edit", exact: true })
      .click();
    await page.getByRole("tab", { name: "Images", exact: true }).click();
    const focus = page.getByRole("slider", { name: "Card focal point" });
    await expect(focus).toHaveAttribute(
      "aria-valuetext",
      "50% across, 50% down",
    );
    await focus.focus();
    await page.keyboard.press("Shift+ArrowRight");
    await page.keyboard.press("ArrowDown");
    await expect(focus).toHaveAttribute(
      "aria-valuetext",
      "60% across, 51% down",
    );
    await expect(page.locator(".admin-focus-preview img")).toHaveCSS(
      "object-position",
      "60% 51%",
    );
    await page
      .getByLabel("Options photo", { exact: true })
      .setInputFiles("public/dishes/crispy-calamari.jpg");
    await expect(
      page.locator(".admin-image-field").nth(1).locator("img"),
    ).toHaveAttribute("src", /^\/api\/media\//);
    await page.getByRole("button", { name: "Save item", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const saved: MenuSnapshot = await (
      await page.request.get("/api/admin/menu")
    ).json();
    const burger = saved.menu.dishes.find((d) => d.id === "sushinaa-burger")!;
    expect(burger.imageFocus).toEqual({ x: 60, y: 51 });
    expect(burger.optionsImage).toMatch(/^\/api\/media\//);
    expect(burger.image).toBe("/dishes/card/sushinaa-burger.webp");
    await page.goto("/down-town");
    const card = page.locator("#dish-sushinaa-burger img.dish-photo");
    await expect(card).toHaveCSS("object-position", "60% 51%");
    await page.locator("#dish-sushinaa-burger .slide-hit").click();
    await expect(page.locator(".detail-photo")).toHaveAttribute(
      "src",
      burger.optionsImage!,
    );
    await expect(page.locator(".detail-photo")).toHaveCSS(
      "object-position",
      "50% 50%",
    );
  } finally {
    const now: MenuSnapshot = await (
      await page.request.get("/api/admin/menu")
    ).json();
    await page.request.put("/api/admin/menu", {
      headers,
      data: { menu: original.menu, revision: now.revision },
    });
  }
});

test("the options photo opens full screen and closes back to the sheet", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/down-town");
  await page.locator("#dish-sushinaa-burger .slide-hit").click();
  const photo = page.locator(".detail-photo-open");
  await photo.click();
  const viewer = page.locator(".viewer");
  await expect(viewer).toHaveAttribute("role", "dialog");
  await expect(viewer).toHaveAttribute("aria-modal", "true");
  await expect(viewer).toHaveAttribute("aria-label", "Sushinaa burger");
  await expect(viewer.locator("img")).toHaveAttribute(
    "src",
    "/dishes/sushinaa-burger.jpg",
  );
  await expect(page.locator(".viewer-close")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator(".viewer-close")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(viewer).toHaveCount(0);
  await expect(page.locator(".detail-sheet")).toBeVisible();
  await expect(photo).toBeFocused();
  await photo.click();
  await page.locator(".viewer-close").click();
  await expect(viewer).toHaveCount(0);
});

test("search opens from its button toward the logo and closes back to it", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/down-town");
  const toggle = page.locator(".chrome-actions .search-toggle");
  // The menu streams in behind the loading screen; measure once it is shown.
  await expect(toggle).toBeVisible();
  await expect(
    page.locator(".chrome-actions > *").first().locator(".search-toggle"),
  ).toHaveCount(1);
  const others = page.locator(".chrome-actions > :not(.header-search)");
  const before = await others.evaluateAll((els) =>
    els.map((el) => el.getBoundingClientRect().x),
  );
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(toggle).toHaveAttribute("aria-label", "Clear search");
  const input = page.locator("#menu-search");
  await expect(input).toBeFocused();
  const logo = page.locator(".brand-navigation .wordmark-img");
  const logoBox = (await logo.boundingBox())!;
  const field = (await page.locator(".header-search-field").boundingBox())!;
  expect(field.x).toBeLessThanOrEqual(logoBox.x + 1);
  await expect(logo).toHaveCSS("opacity", "0");
  expect(
    await others.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().x)),
  ).toEqual(before);
  await input.pressSequentially("burger");
  await expect(
    page.locator(".search-result", { hasText: "Sushinaa burger" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toBeFocused();
  await expect(input).toHaveValue("");
  await expect(page.locator(".search-result")).toHaveCount(0);
  await toggle.click();
  await expect(input).toBeFocused();
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
});

type SearchProbe = {
  moved: string[];
  first: string | null;
  open?: { handlerMs: number; open: boolean; moving: boolean };
};

test("search is closed from the first frame and its first open starts on the next frame", async ({
  page,
  baseURL,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    const probe: SearchProbe = { moved: [], first: null };
    (window as unknown as { searchProbe: SearchProbe }).searchProbe = probe;
    document.addEventListener("transitionrun", (e) => {
      const el = e.target as Element;
      if (el.closest(".chrome-header")) probe.moved.push(`${el.className}: ${e.propertyName}`);
    }, true);
    // The first frame the field is laid out in: it must already be closed and still.
    const frame = () => {
      const field = document.querySelector(".header-search-field");
      if (!field?.getBoundingClientRect().width) return requestAnimationFrame(frame);
      probe.first = [
        getComputedStyle(field).clipPath,
        document.querySelector("header")!.className,
        field.getAnimations().length,
      ].join(" | ");
    };
    requestAnimationFrame(frame);
  });
  const toggle = page.locator(".chrome-actions .search-toggle");
  // Time the tap's own work and check the very next frame.
  const open = async () => {
    await page.evaluate(() => {
      const probe = (window as unknown as { searchProbe: SearchProbe }).searchProbe;
      let start = 0;
      addEventListener("click", () => {
        start = performance.now();
        requestAnimationFrame(() => {
          const field = document.querySelector(".header-search-field")!;
          probe.open!.open = document.querySelector("header")!.classList.contains("search-open");
          probe.open!.moving = field.getAnimations().some(
            (a) => (a as CSSTransition).transitionProperty === "clip-path" && a.playState === "running",
          );
        });
      }, { capture: true, once: true });
      addEventListener("click", () => {
        probe.open = { handlerMs: performance.now() - start, open: false, moving: false };
      }, { once: true });
    });
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await page.waitForTimeout(50);
    return page.evaluate(() => (window as unknown as { searchProbe: SearchProbe }).searchProbe.open!);
  };
  for (const lang of ["en", "ar"]) {
    await page.context().addCookies([{ name: "sushina-lang", value: lang, url: baseURL! }]);
    await page.goto("/down-town");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await page.waitForTimeout(800);
    const load = await page.evaluate(() => (window as unknown as { searchProbe: SearchProbe }).searchProbe);
    expect(load.moved, lang).toEqual([]);
    expect(load.first, lang).toMatch(/^inset\(.*calc\(100% - 44px\).* \| chrome-header \| 0$/);
    const first = await open();
    await page.keyboard.press("Escape");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await page.waitForTimeout(300);
    const later = await open();
    for (const tap of [first, later]) expect(tap, lang).toMatchObject({ open: true, moving: true });
    expect(first.handlerMs, lang).toBeLessThan(later.handlerMs + 20);
  }
});

test("the header category menu follows the feed", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/down-town");
  const menuButton = page.getByRole("button", { name: /^Category:/ });
  await expect(menuButton).toHaveAccessibleName("Category: New");
  await expect(menuButton).toHaveAttribute("aria-expanded", "false");
  await menuButton.click();
  const categories = page.getByRole("dialog", { name: "Menu" });
  await expect(categories).toBeVisible();
  await expect(categories.getByRole("button", { name: "New" })).toHaveAttribute("aria-current", "true");
  await categories.getByRole("button", { name: "Poke" }).click();
  await expect(categories).toHaveCount(0);
  await expect(menuButton).toBeFocused();
  await expect(menuButton).toHaveAccessibleName("Category: Poke");
  const feed = page.locator(".feed");
  const firstPoke = await page.evaluate(async () => {
    const { menu } = await (await fetch("/api/menu")).json();
    return menu.dishes.find((d: { section: string }) => d.section === "Poke bowls").id;
  });
  await expect(page.locator(`#dish-${firstPoke}`)).toBeInViewport();
  await menuButton.click();
  await page.keyboard.press("Escape");
  await expect(categories).toHaveCount(0);
  await expect(menuButton).toBeFocused();
  await expect(menuButton).toHaveAccessibleName("Category: Poke");
  await feed.evaluate((f) => f.scrollBy(0, -f.clientHeight));
  await expect(menuButton).not.toHaveAccessibleName("Category: Poke");
});

test("every admin write leaves an activity row and failed writes leave none", async ({
  page,
  baseURL,
}) => {
  const headers = { Origin: baseURL!, "x-forwarded-for": "203.0.113.7, 10.0.0.1" };
  const api = page.request;
  const wrong = `wrong-${Date.now()}`;
  expect(
    (await api.post("/api/admin/session", { headers, data: { username: admin.username, password: wrong } })).status(),
  ).toBe(401);
  await api.post("/api/admin/session", { headers, data: admin });
  type Row = { id: number; action: string; actor: string | null; entityId: string | null; ip: string | null };
  const rows = async (): Promise<Row[]> => (await (await api.get("/api/admin/activity")).json()).rows;
  const latest = await rows();
  expect(latest.slice(0, 2).map((r) => r.action)).toEqual(["session.sign_in", "session.sign_in_failed"]);
  expect(latest[1].actor).toBeNull();
  expect(latest[0].ip).toBe("203.0.113.7");
  const since = latest[0].id;
  const newer = async () => (await rows()).filter((r) => r.id > since);
  const snapshot: MenuSnapshot = await (await api.get("/api/admin/menu")).json();
  const original = structuredClone(snapshot.menu);
  // Refused writes: stale revision, over-limit text, a non-image upload.
  const stale = structuredClone(snapshot);
  stale.revision -= 1;
  stale.menu.dishes[0].description = "Stale";
  expect((await api.put("/api/admin/menu", { headers, data: stale })).status()).toBe(409);
  const long = structuredClone(snapshot);
  long.menu.dishes[0].name = "x".repeat(80);
  expect((await api.put("/api/admin/menu", { headers, data: long })).status()).toBe(422);
  expect(
    (await api.post("/api/admin/media", {
      headers,
      multipart: { file: { name: "note.png", mimeType: "image/png", buffer: Buffer.from("not an image") } },
    })).status(),
  ).toBe(422);
  expect(await newer()).toEqual([]);
  // Accepted writes.
  const next = structuredClone(snapshot);
  next.menu.dishes[0].description = "Audited change";
  next.menu.dishes[1].visible = false;
  next.menu.settings.tagline = "Audited tagline";
  const saved = await api.put("/api/admin/menu", { headers, data: next });
  expect(saved.status()).toBe(200);
  const upload = await api.post("/api/admin/media", {
    headers,
    multipart: { file: { name: "burger.jpg", mimeType: "image/jpeg", buffer: readFileSync("public/dishes/sushinaa-burger.jpg") } },
  });
  expect(upload.status()).toBe(200);
  const restored = await api.put("/api/admin/menu", {
    headers,
    data: { revision: (await saved.json()).revision, menu: original },
  });
  expect(restored.status()).toBe(200);
  await page.goto("/admin");
  await page.getByRole("button", { name: "Activity", exact: true }).click();
  await expect(page.getByText(`Changed item “${original.dishes[0].name}”: description`).first()).toBeVisible();
  await page.getByLabel("Show activity for").selectOption("settings");
  await expect(page.getByText("Changed settings: tagline").first()).toBeVisible();
  await expect(page.locator(".admin-activity li").first()).toContainText("Changed settings: tagline");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/login/);
  await api.post("/api/admin/session", { headers, data: admin });
  const all = await newer();
  const actions = all.map((r) => `${r.action} ${r.entityId ?? ""}`.trim());
  for (const want of [
    `item.update ${original.dishes[0].id}`,
    `item.hide ${original.dishes[1].id}`,
    "settings.update",
    "media.upload " + (await upload.json()).url.split("/").pop(),
    `item.show ${original.dishes[1].id}`,
    "session.sign_out",
  ])
    expect(actions).toContain(want);
  // No password, cookie or session token in any row.
  const cookie = (await page.context().cookies()).find((c) => c.name === "sushinaa-admin")!.value;
  const dump = JSON.stringify(await (await api.get("/api/admin/activity?page=1")).json());
  expect(dump).not.toContain(wrong);
  expect(dump).not.toContain(cookie);
  expect(dump).not.toMatch(/password|cookie|token/i);
});

test("sign-in limits, session rotation, upload sniffing and headers", async ({
  playwright,
  baseURL,
}) => {
  const origin = baseURL!;
  const client = (ip: string) =>
    playwright.request.newContext({ baseURL: origin, extraHTTPHeaders: { Origin: origin, "x-forwarded-for": ip } });
  // Five wrong passwords from one address lock that name there, even for the right one.
  const locked = await client("198.51.100.20");
  for (let i = 0; i < 5; i++)
    expect((await locked.post("/api/admin/session", { data: { username: admin.username, password: `wrong-${i}` } })).status()).toBe(401);
  const blocked = await locked.post("/api/admin/session", { data: admin });
  expect(blocked.status()).toBe(429);
  expect(Number(blocked.headers()["retry-after"])).toBeGreaterThan(0);
  await locked.dispose();
  // A new sign-in replaces the session the browser had.
  const api = await client("198.51.100.21");
  expect((await api.post("/api/admin/session", { data: admin })).status()).toBe(200);
  const first = (await api.storageState()).cookies.find((c) => c.name === "sushinaa-admin")!;
  expect(first.httpOnly).toBe(true);
  expect(first.sameSite).toBe("Strict");
  expect(first.path).toBe("/");
  expect((await api.post("/api/admin/session", { data: admin })).status()).toBe(200);
  const old = await playwright.request.newContext({
    baseURL: origin,
    extraHTTPHeaders: { Cookie: `sushinaa-admin=${first.value}` },
  });
  expect((await old.get("/api/admin/menu")).status()).toBe(401);
  await old.dispose();
  // Writes need the same origin.
  expect((await api.put("/api/admin/menu", { headers: { Origin: "https://evil.example" }, data: {} })).status()).toBe(403);
  // An SVG claiming to be a PNG is refused by its bytes.
  const svg = await api.post("/api/admin/media", {
    multipart: { file: { name: "logo.png", mimeType: "image/png", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>') } },
  });
  expect(svg.status()).toBe(422);
  const photo = await api.post("/api/admin/media", {
    multipart: { file: { name: "x.txt", mimeType: "text/plain", buffer: readFileSync("public/dishes/sushinaa-burger.jpg") } },
  });
  expect(photo.status()).toBe(200);
  const media = await api.get((await photo.json()).url);
  expect(media.headers()["content-type"]).toBe("image/webp");
  expect(media.headers()["x-content-type-options"]).toBe("nosniff");
  const page = await api.get("/");
  for (const [k, v] of Object.entries({
    "x-frame-options": "DENY",
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
  }))
    expect(page.headers()[k]).toBe(v);
  expect(page.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(page.headers()["permissions-policy"]).toContain("camera=()");
  // The public menu has no admin-only data.
  const pub = JSON.stringify(await (await api.get("/api/menu")).json());
  expect(pub).not.toMatch(/updatedAt|sign_in|sessions|audit/);
  await api.delete("/api/admin/session");
  await api.dispose();
});

// break-ui stress: the longest text the limits allow, an unbroken word,
// 4-digit prices and big quantities, at the narrowest phone in both languages.
test("the longest allowed text and 4-digit prices keep the card and sheet intact", async ({
  page,
  baseURL,
}) => {
  const headers = { Origin: baseURL! };
  await page.request.post("/api/admin/session", {
    headers,
    data: admin,
  });
  const original: MenuSnapshot = await (
    await page.request.get("/api/admin/menu")
  ).json();
  const stress = structuredClone(original.menu);
  const fill = (s: string, n: number) =>
    s.repeat(Math.ceil(n / s.length)).slice(0, n);
  const burger = stress.dishes.find((d) => d.id === "sushinaa-burger")!;
  burger.name = fill("Supercalifragilistic", 36); // one unbroken word
  burger.nameAr = fill("برجر سوشينا المقرمش الكبير ", 42);
  burger.description = fill(
    "Crispy shrimp, crab stick and avocado with spicy mayo. ",
    200,
  );
  burger.descriptionAr = fill(
    "روبيان مقرمش وكابوريا وأفوكادو مع مايونيز حار. ",
    220,
  );
  if (burger.kind.type !== "addons") throw new Error("burger has add-ons");
  burger.kind.priceQar = 9999;
  burger.kind.extras[0].name = fill("Extra spicy crunchy topping ", 28);
  burger.kind.extras[0].nameAr = fill("إضافة صوص حار مقرمش جدا ", 28);
  burger.kind.extras[0].priceQar = 1250;
  const section = stress.categories.find((c) => c.id === burger.section)!;
  section.name = fill("Chef specials today ", 20);
  section.nameAr = fill("أطباق الشيف اليوم ", 20);
  const saved = await page.request.put("/api/admin/menu", {
    headers,
    data: { menu: stress, revision: original.revision },
  });
  expect(saved.status()).toBe(200);
  try {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.addInitScript(() => localStorage.clear());
    for (const lang of ["en", "ar"]) {
      await page.goto("/down-town");
      if (lang === "ar")
        await page.getByRole("button", { name: "Switch to Arabic" }).click();
      const card = page.locator("#dish-sushinaa-burger");
      const name = card.locator(".dish-name");
      const lines = await name.evaluate(
        (e) => e.clientHeight / parseFloat(getComputedStyle(e).lineHeight),
      );
      expect(Math.round(lines)).toBeLessThanOrEqual(2);
      const fits = (e: Element) => e.scrollWidth <= e.clientWidth;
      expect(await card.locator(".slide-copy").evaluate(fits)).toBe(true);
      await card.locator(".slide-hit").click();
      const plus = page.locator(".detail-foot .qty-btn").last();
      for (let i = 1; i < 20; i++) await plus.click();
      const add = page.locator(".detail-add");
      await expect(add).toContainText("199980");
      // One line: no wrapping and nothing spilling out of the button.
      expect(
        await add.evaluate((e) => e.getBoundingClientRect().height),
      ).toBeLessThanOrEqual(48);
      expect(await add.evaluate(fits)).toBe(true);
      expect(await page.locator(".detail-sheet").evaluate(fits)).toBe(true);
      const page_ = await page.evaluate(
        () =>
          document.scrollingElement!.scrollWidth -
          document.scrollingElement!.clientWidth,
      );
      expect(page_).toBe(0);
      await page
        .getByRole("button", {
          name: lang === "en" ? "Close" : "إغلاق",
          exact: true,
        })
        .click();
    }
    // The admin list and editor take the same text without spilling.
    await page.goto("/admin?q=super");
    const row = page.locator(".admin-row").first();
    expect(await row.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(
      true,
    );
    await row.getByRole("button", { name: "Edit", exact: true }).click();
    const head = page.locator(".admin-dialog-head");
    expect(await head.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(
      true,
    );
    await expect(page.locator(".admin-count").first()).toHaveText("36 / 36");
  } finally {
    const now: MenuSnapshot = await (
      await page.request.get("/api/admin/menu")
    ).json();
    await page.request.put("/api/admin/menu", {
      headers,
      data: { menu: original.menu, revision: now.revision },
    });
  }
});
