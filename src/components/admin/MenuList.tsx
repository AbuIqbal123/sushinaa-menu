"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { MenuData, CmsDish, Category } from "@/cms/schema";
import { minPriceOf } from "@/ordering/price";
import { MoveButtons, moveEntry } from "./Fields";
export function MenuList({
  menu,
  busy,
  onAdd,
  onEdit,
  onEditCategory,
  onChange,
}: {
  menu: MenuData;
  busy: boolean;
  onAdd: (id: string) => void;
  onEdit: (d: CmsDish) => void;
  onEditCategory: (c: Category) => void;
  onChange: (m: MenuData) => Promise<void>;
}) {
  const categories = [...menu.categories].sort((a, b) => a.order - b.order);
  // Filters live in the URL (?category=&show=&q=) so a reload or shared link
  // keeps them; unknown values fall back to "all".
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [category, setCategory] = useState(() => {
    const id = params.get("category");
    return categories.some((c) => c.id === id) ? id! : "";
  });
  const [show, setShow] = useState(() => {
    const s = params.get("show");
    return s === "active" || s === "hidden" ? s : "";
  });
  useEffect(() => {
    const next = new URLSearchParams();
    if (category) next.set("category", category);
    if (show) next.set("show", show);
    if (query) next.set("q", query);
    // history.replaceState updates the URL without a server round trip per keystroke.
    const path = window.location.pathname;
    window.history.replaceState(null, "", `${next}` ? `${path}?${next}` : path);
    return () => window.history.replaceState(null, "", path);
  }, [category, show, query]);
  const sorted = (id: string) =>
    menu.dishes
      .filter((d) => d.section === id)
      .sort((a, b) => a.order - b.order);
  const needle = query.trim().toLowerCase();
  const matches = (d: CmsDish, c: Category) =>
    [d.name, d.nameAr, d.description, d.descriptionAr]
      .join(" ")
      .toLowerCase()
      .includes(needle) &&
    (!show || (show === "active") === (d.visible && d.available && c.visible));
  const filtering = Boolean(needle || show);
  const groups = categories
    .filter(
      (c) =>
        !category ||
        c.id === category ||
        !categories.some((x) => x.id === category),
    )
    .map((c) => {
      const all = sorted(c.id);
      return { c, all, dishes: all.filter((d) => matches(d, c)) };
    })
    .filter((g) => !filtering || g.dishes.length);
  return (
    <>
      <div className="admin-toolbar">
        <input
          dir="auto"
          aria-label="Search menu"
          placeholder="Search names or descriptions…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="toolbar-category"
          aria-label="Filter by category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {/* Isolate the name so its direction never reorders the count. */}
              {`\u2068${c.name}\u2069 · ${sorted(c.id).length}`}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by visibility"
          value={show}
          onChange={(e) => setShow(e.target.value)}
        >
          <option value="">All items</option>
          <option value="active">Active</option>
          <option value="hidden">Hidden or unavailable</option>
        </select>
      </div>
      {filtering && !groups.length && (
        <p className="admin-empty">
          No items match.{" "}
          <button
            onClick={() => {
              setQuery("");
              setShow("");
              setCategory("");
            }}
          >
            Clear search and filters
          </button>
        </p>
      )}
      {groups.map(({ c, all, dishes }) => {
        return (
          <details open className="admin-card admin-group" key={c.id}>
            <summary>
              <h2>
                {c.name} <small>({dishes.length})</small>
              </h2>
              <span className={"admin-pill" + (c.visible ? "" : " off")}>
                {c.visible ? "Visible" : "Hidden"}
              </span>
            </summary>
            <div className="admin-actions">
              <button onClick={() => onAdd(c.id)}>Add item</button>
              <button onClick={() => onEditCategory(c)}>Edit category</button>
            </div>
            {dishes.length === 0 && (
              <p className="admin-empty">No items in this category yet.</p>
            )}
            {dishes.map((d) => (
              <div className="admin-row" key={d.id}>
                <img src={d.image} alt="" />
                <div className="grow">
                  <strong>{d.name}</strong>
                  <small>
                    <bdi>
                      {minPriceOf(d)} {menu.settings.currencyEn}
                    </bdi>{" "}
                    · <bdi lang="ar">{d.nameAr}</bdi>
                  </small>
                </div>
                <span
                  className={
                    "admin-pill" +
                    (d.visible && d.available && c.visible ? "" : " off")
                  }
                >
                  {!d.visible
                    ? "Hidden"
                    : !d.available
                      ? "Unavailable"
                      : !c.visible
                        ? "Category hidden"
                        : "Active"}
                </span>
                <div className="admin-actions">
                  <MoveButtons
                    index={all.findIndex((x) => x.id === d.id)}
                    length={all.length}
                    label={d.name}
                    move={(to) => {
                      const ordered = moveEntry(
                        all,
                        all.findIndex((x) => x.id === d.id),
                        to,
                      ).map((x, order) => ({ ...x, order }));
                      void onChange({
                        ...menu,
                        dishes: [
                          ...menu.dishes.filter((x) => x.section !== c.id),
                          ...ordered,
                        ],
                      });
                    }}
                  />
                  <button disabled={busy} onClick={() => onEdit(d)}>
                    Edit
                  </button>
                  <button
                    disabled={busy}
                    onClick={() =>
                      onChange({
                        ...menu,
                        dishes: menu.dishes.map((x) =>
                          x.id === d.id
                            ? {
                                ...x,
                                visible: !x.visible,
                                updatedAt: new Date().toISOString(),
                              }
                            : x,
                        ),
                      })
                    }
                  >
                    {d.visible ? "Hide" : "Show"}
                  </button>
                  <button
                    className="danger"
                    disabled={busy}
                    onClick={() => {
                      if (
                        confirm(
                          `Delete “${d.name}” and its options? This cannot be undone.`,
                        )
                      )
                        void onChange({
                          ...menu,
                          dishes: menu.dishes.filter((x) => x.id !== d.id),
                        });
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </details>
        );
      })}
      {categories.length === 0 && (
        <p className="admin-empty">Create a category to start your menu.</p>
      )}
    </>
  );
}
