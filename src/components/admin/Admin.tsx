"use client";
import { useLocale } from "@/i18n/locale";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
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
import { Orders } from "./Orders";
import { StaffPanel } from "./StaffPanel";
import { Activity } from "./Activity";
import type { Role } from "@/cms/permissions";
import { confirmDiscard } from "./Fields";
import { useNotify } from "./Notices";
export function Admin({ initial, role }: { initial: MenuSnapshot; role: Role }) {
  const { lang } = useLocale();
  const [unreadOrders, setUnreadOrders] = useState(0);
  const [snapshot, setSnapshot] = useState(initial);
  const params = useSearchParams();
  // A filtered menu link (?category=&show=&q=) opens straight on the Menu.
  const sections = role === "admin"
    ? ["Dashboard", "Orders", "Menu", "Categories", "Users", "Settings", "Activity"]
    : ["Orders"];
  const [section, setSection] = useState(() =>
    role !== "admin" ? "Orders" : ["category", "show", "q"].some((k) => params.has(k)) ? "Menu" : "Dashboard",
  );
  const [item, setItem] = useState<CmsDish | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [busy, setBusy] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const notify = useNotify();
  const { menu } = snapshot;
  const categories = [...menu.categories].sort((a, b) => a.order - b.order);
  async function save(next: MenuData) {
    if (busy) throw new Error("Please wait for the current save.");
    setBusy(true);
    try {
      const r = await fetch("/api/admin/menu", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ menu: next, revision: snapshot.revision }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Unable to save");
      setSnapshot(data);
      notify({ tone: "ok", text: "Changes saved" });
    } catch (e) {
      const text = e instanceof Error ? e.message : "Unable to save";
      notify({
        tone: "error",
        text: `Couldn’t save: ${text}. Your edits are still here.`,
        action: text.includes("Reload before saving")
          ? { label: "Reload", onClick: () => window.location.reload() }
          : undefined,
      });
      throw e;
    } finally {
      setBusy(false);
    }
  }
  async function run(next: MenuData) {
    try {
      await save(next);
    } catch {
      // The toast already says the edits are still here.
    }
  }
  function newItem(id = categories[0]?.id) {
    if (!id) {
      setSection("Categories");
      notify({ tone: "ok", text: "Create a category first" });
      return;
    }
    setItem({
      id: "",
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
        <div className="admin-brand">{menu.settings.name}</div>
        {sections.map((s) => (
          <button
            key={s}
            className={section === s ? "active" : ""}
            aria-current={section === s ? "page" : undefined}
            onClick={() => {
              if (s === section || !confirmDiscard()) return;
              setSection(s);
              setCreatingUser(false);
            }}
          >
            {s === "Users" && lang === "ar" ? "المستخدمون" : s}{s === "Orders" && unreadOrders > 0 && <span className="staff-unread">{unreadOrders}</span>}
          </button>
        ))}
        <a className="bottom" href="/" target="_blank" rel="noreferrer">
          View public menu ↗
        </a>
        <button
          onClick={async () => {
            if (!confirmDiscard()) return;
            try {
              const r = await fetch("/api/admin/session", { method: "DELETE" });
              if (!r.ok) throw new Error("Unable to sign out");
              window.location.assign("/admin/login");
            } catch (e) {
              notify({
                tone: "error",
                text: e instanceof Error ? e.message : "Unable to sign out",
              });
            }
          }}
        >
          Sign out
        </button>
      </aside>
      <div className="admin-main">
        <main className="admin-content">
          <div className="admin-heading">
            <h1>{section === "Menu" ? "Your menu" : section === "Orders" ? "Orders" : section === "Users" && lang === "ar" ? "المستخدمون" : section}</h1>
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
                    id: "",
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
            {section === "Users" && role === "admin" && (
              <button className="primary" type="button" onClick={() => setCreatingUser(true)}>
                {lang === "ar" ? "إنشاء مستخدم جديد" : "Create new user"}
              </button>
            )}
          </div>
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
          <Orders active={section === "Orders"} onUnread={setUnreadOrders} role={role} menu={menu} />
          {section === "Users" && role === "admin" && <StaffPanel creating={creatingUser} onCreating={setCreatingUser} />}
          {section === "Activity" && <Activity />}
          {section === "Settings" && role === "admin" && (
            <SettingsEditor key={snapshot.revision} menu={menu} onSave={save} />
          )}
        </main>
      </div>
      {item && (
        <ItemEditor
          key={item.id}
          item={item}
          categories={categories}
          dishes={menu.dishes}
          currency={menu.settings.currencyEn}
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
          taken={menu.categories.map((c) => c.id)}
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
