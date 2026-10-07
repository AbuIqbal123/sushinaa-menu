import type { MenuData, Category } from "@/cms/schema";
import { MoveButtons, moveEntry } from "./Fields";
export function CategoryList({
  menu,
  busy,
  onEdit,
  onChange,
}: {
  menu: MenuData;
  busy: boolean;
  onEdit: (c: Category) => void;
  onChange: (m: MenuData) => Promise<void>;
}) {
  const categories = [...menu.categories].sort((a, b) => a.order - b.order);
  const sorted = (id: string) => menu.dishes.filter((d) => d.section === id);
  return (
    <div className="admin-card">
      {categories.map((c, i) => (
        <div className="admin-row" key={c.id}>
          <div className="grow">
            <strong>{c.name}</strong>
            <small>
              <bdi lang="ar">{c.nameAr}</bdi> · {sorted(c.id).length} items ·{" "}
              {c.visible ? "Visible" : "Hidden"}
            </small>
          </div>
          <div className="admin-actions">
            <MoveButtons
              index={i}
              length={categories.length}
              label={c.name}
              move={(to) =>
                onChange({
                  ...menu,
                  categories: moveEntry(categories, i, to).map((c, order) => ({
                    ...c,
                    order,
                  })),
                })
              }
            />
            <button onClick={() => onEdit(c)}>Edit</button>
            <button
              disabled={busy}
              onClick={() =>
                onChange({
                  ...menu,
                  categories: menu.categories.map((x) =>
                    x.id === c.id ? { ...x, visible: !x.visible } : x,
                  ),
                })
              }
            >
              {c.visible ? "Hide" : "Show"}
            </button>
            <button
              className="danger"
              disabled={busy || sorted(c.id).length > 0}
              title={
                sorted(c.id).length
                  ? "Move or delete the items first"
                  : "Delete empty category"
              }
              onClick={() => {
                if (confirm(`Delete empty category “${c.name}”?`))
                  void onChange({
                    ...menu,
                    categories: menu.categories.filter((x) => x.id !== c.id),
                  });
              }}
            >
              Delete
            </button>
          </div>
        </div>
      ))}
      {!categories.length && (
        <p className="admin-empty">
          No categories yet. Add your first category.
        </p>
      )}
      <small>
        To delete a category, first move or delete its items. Hiding a category
        hides all its items.
      </small>
    </div>
  );
}
