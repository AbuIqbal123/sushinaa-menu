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
    await page.getByRole("button", { name: "Images", exact: true }).click();
    await page
      .getByLabel("Primary image", { exact: true })
      .fill("/dishes/sushinaa-burger.jpg");
    await page.getByRole("button", { name: "Options", exact: true }).click();
    await page.getByLabel("Base price", { exact: true }).fill("12.5");
    await page.getByRole("button", { name: "Save item", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    snapshot = await (await api.get("/api/admin/menu")).json();
    const dish = snapshot.menu.dishes.find((d) => d.name === "Test dish")!;
    expect(dish).toBeTruthy();
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
  await page.getByRole("button", { name: "Logout", exact: true }).click();
  await expect(page).toHaveURL(/login/);
  expect((await api.get("/api/admin/menu")).status()).toBe(401);
});
test("public menu works at mobile and desktop widths in both languages", async ({
  page,
}) => {
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
    await page.evaluate(() => localStorage.clear());
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
    const burger = page
      .locator(".admin-row")
      .filter({
        has: page.locator("strong", { hasText: /^Sushinaa burger$/ }),
      });
    await burger.getByRole("button", { name: "Edit", exact: true }).click();
    await page.getByRole("button", { name: "Options", exact: true }).click();
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
    await burger.getByRole("button", { name: "Edit", exact: true }).click();
    await page.getByRole("button", { name: "Options", exact: true }).click();
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
    await page
      .getByRole("button", { name: "Menu wording", exact: true })
      .click();
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
