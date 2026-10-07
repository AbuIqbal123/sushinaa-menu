"use client";
import { useEffect, useState } from "react";
import {
  type MenuSnapshot,
  type MenuData,
  type CmsDish,
  type Category,
} from "@/cms/schema";
import { ItemEditor } from "./ItemEditor";
import { SettingsEditor } from "./SettingsEditor";
import { CategoryEditor } from "./CategoryEditor";
import { CategoryList } from "./CategoryList";
import { MenuList } from "./MenuList";
import { Dashboard } from "./Dashboard";
export function Admin({ initial }: { initial: MenuSnapshot }) {
  const [snapshot, setSnapshot] = useState(initial);
  const [section, setSection] = useState("Dashboard");
  const [item, setItem] = useState<CmsDish | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const { menu } = snapshot;
  const categories = [...menu.categories].sort((a, b) => a.order - b.order);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(t);
  }, [toast]);
  async function save(next: MenuData) {
    if (busy) throw new Error("Please wait for the current save.");
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/admin/menu", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ menu: next, revision: snapshot.revision }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setSnapshot(data);
      setToast("Changes saved");
    } finally {
      setBusy(false);
    }
  }
  async function run(next: MenuData) {
    try {
      await save(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save");
    }
  }
  function newItem(id = categories[0]?.id) {
    if (!id) {
      setSection("Categories");
      setToast("Create a category first");
      return;
    }
    setItem({
      id: crypto.randomUUID(),
      name: "",
      nameAr: "",
      section: id,
      description: "",
      descriptionAr: "",
      image: "",
      imageAlt: "",
      imageAltAr: "",
      tags: [],
      kind: { type: "simple", priceQar: 0 },
      order:
        Math.max(
          -1,
          ...menu.dishes.filter((d) => d.section === id).map((d) => d.order),
        ) + 1,
      visible: true,
      available: true,
    });
  }
  const sorted = (id: string) =>
    menu.dishes
      .filter((d) => d.section === id)
      .sort((a, b) => a.order - b.order);
  return (
    <>
      <aside className="admin-sidebar">
        <div className="admin-brand">
          {menu.settings.name}
          <small>Menu workspace</small>
        </div>
        {["Dashboard", "Menu", "Categories", "Settings"].map((s) => (
          <button
            key={s}
            className={section === s ? "active" : ""}
            onClick={() => {
              setSection(s);
              setError("");
            }}
          >
            {s}
          </button>
        ))}
        <a className="bottom" href="/" target="_blank" rel="noreferrer">
          View public menu ↗
        </a>
        <button
          onClick={async () => {
            try {
              const r = await fetch("/api/admin/session", { method: "DELETE" });
              if (!r.ok) throw new Error("Unable to sign out");
              window.location.assign("/admin/login");
            } catch (e) {
              setError(String(e));
            }
          }}
        >
          Logout
        </button>
      </aside>
      <div className="admin-main">
        <header className="admin-top">
          <span>{section}</span>
          <span className="muted">Administrator · Live menu</span>
        </header>
        <main className="admin-content">
          <div className="admin-heading">
            <div>
              <h1>{section === "Menu" ? "Your menu" : section}</h1>
              <p className="muted">
                {section === "Dashboard"
                  ? "Manage what your guests see and order."
                  : section === "Settings"
                    ? "Restaurant details, language and menu controls."
                    : "Organize and update your restaurant menu."}
              </p>
            </div>
            {section === "Menu" && (
              <button className="primary" onClick={() => newItem()}>
                Add item
              </button>
            )}
            {section === "Categories" && (
              <button
                className="primary"
                onClick={() =>
                  setCategory({
                    id: crypto.randomUUID(),
                    name: "",
                    nameAr: "",
                    order: Math.max(-1, ...categories.map((c) => c.order)) + 1,
                    visible: true,
                    featured: false,
                  })
                }
              >
                Add category
              </button>
            )}
          </div>
          {error && (
            <div className="admin-error" role="alert">
              {error}
              <button onClick={() => window.location.reload()}>
                Reload latest menu
              </button>
            </div>
          )}
          {section === "Dashboard" && (
            <Dashboard
              menu={menu}
              onEdit={setItem}
              onMenu={() => setSection("Menu")}
            />
          )}
          {section === "Menu" && (
            <MenuList
              menu={menu}
              busy={busy}
              onAdd={newItem}
              onEdit={setItem}
              onEditCategory={setCategory}
              onCategories={() => setSection("Categories")}
              onChange={run}
            />
          )}
          {section === "Categories" && (
            <CategoryList
              menu={menu}
              busy={busy}
              onEdit={setCategory}
              onChange={run}
            />
          )}
          {section === "Settings" && (
            <SettingsEditor key={snapshot.revision} menu={menu} onSave={save} />
          )}
        </main>
      </div>
      {toast && (
        <div className="admin-toast" role="status">
          {toast}
        </div>
      )}
      {item && (
        <ItemEditor
          key={item.id}
          item={item}
          categories={categories}
          onClose={() => setItem(null)}
          onSave={async (d) => {
            const previous = menu.dishes.find((x) => x.id === d.id);
            if (!previous || previous.section !== d.section)
              d.order =
                Math.max(-1, ...sorted(d.section).map((x) => x.order)) + 1;
            await save({
              ...menu,
              dishes: previous
                ? menu.dishes.map((x) => (x.id === d.id ? d : x))
                : [...menu.dishes, d],
            });
          }}
        />
      )}
      {category && (
        <CategoryEditor
          key={category.id}
          category={category}
          onClose={() => setCategory(null)}
          onSave={async (c) => {
            await save({
              ...menu,
              categories: menu.categories.some((x) => x.id === c.id)
                ? menu.categories.map((x) => (x.id === c.id ? c : x))
                : [...menu.categories, c],
            });
          }}
        />
      )}
    </>
  );
}
