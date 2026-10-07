import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { MenuSnapshot } from "../../src/cms/schema";
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
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password", { exact: true }).fill("wrong");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator(".admin-error")).toContainText("Invalid");
  await page.getByLabel("Password", { exact: true }).fill("admin");
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
    await page.goto("/");
    await page
      .getByRole("combobox", { name: "Category", exact: true })
      .selectOption({ label: "Test category" });
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
    await page.goto("/");
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
    data: { username: "admin", password: "admin" },
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
    expect(changed.image).toBe("/dishes/sushinaa-burger.jpg");
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
    await page.goto("/");
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
    await page.goto("/");
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
    data: { username: "admin", password: "admin" },
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
    data: { username: "admin", password: "admin" },
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
    data: { username: "admin", password: "admin" },
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
    data: { username: "admin", password: "admin" },
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
    data: { username: "admin", password: "admin" },
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
      "17.3% across, 50% down",
    );
    await focus.focus();
    await page.keyboard.press("Shift+ArrowRight");
    await page.keyboard.press("ArrowDown");
    await expect(focus).toHaveAttribute(
      "aria-valuetext",
      "27% across, 51% down",
    );
    await expect(page.locator(".admin-focus-preview img")).toHaveCSS(
      "object-position",
      "27% 51%",
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
    expect(burger.imageFocus).toEqual({ x: 27, y: 51 });
    expect(burger.optionsImage).toMatch(/^\/api\/media\//);
    expect(burger.image).toBe("/dishes/sushinaa-burger.jpg");
    await page.goto("/");
    const card = page.locator("#dish-sushinaa-burger img.dish-photo");
    await expect(card).toHaveCSS("object-position", "27% 51%");
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
