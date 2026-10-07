"use client";
import { useState } from "react";
import type { MenuData, CmsDish, Category } from "@/cms/schema";
import { minPriceOf } from "@/ordering/price";
import { MoveButtons, moveEntry } from "./Fields";
export function MenuList({
  menu,
  busy,
  onAdd,
  onEdit,
  onEditCategory,
  onCategories,
  onChange,
}: {
  menu: MenuData;
  busy: boolean;
  onAdd: (id: string) => void;
  onEdit: (d: CmsDish) => void;
  onEditCategory: (c: Category) => void;
  onCategories: () => void;
  onChange: (m: MenuData) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const categories = [...menu.categories].sort((a, b) => a.order - b.order);
  const sorted = (id: string) =>
    menu.dishes
      .filter((d) => d.section === id)
      .sort((a, b) => a.order - b.order);
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
          aria-label="Filter status"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ width: "auto" }}
        >
          <option value="all">All items</option>
          <option value="active">Active</option>
          <option value="inactive">Hidden / unavailable</option>
        </select>
        <button
          onClick={() => {
            onCategories();
          }}
        >
          Manage categories
        </button>
      </div>
      {categories.map((c) => {
        const all = sorted(c.id);
        const dishes = all.filter(
          (d) =>
            (d.name + d.nameAr + d.description)
              .toLowerCase()
              .includes(query.toLowerCase()) &&
            (filter === "all" ||
              (filter === "active"
                ? d.visible && d.available && c.visible
                : !d.visible || !d.available || !c.visible)),
        );
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
              <p className="admin-empty">
                No items here. Add an item or adjust your search.
              </p>
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
