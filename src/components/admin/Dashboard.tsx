import type { MenuData, CmsDish } from "@/cms/schema";
export function Dashboard({
  menu,
  onEdit,
  onMenu,
}: {
  menu: MenuData;
  onEdit: (d: CmsDish) => void;
  onMenu: () => void;
}) {
  const categories = menu.categories;
  const active = menu.dishes.filter(
    (d) =>
      d.visible &&
      d.available &&
      categories.find((c) => c.id === d.section)?.visible,
  ).length;
  return (
    <>
      <div className="admin-stats">
        {[
          ["Categories", categories.length],
          ["Menu items", menu.dishes.length],
          ["Active items", active],
          ["Hidden / unavailable", menu.dishes.length - active],
        ].map(([label, n]) => (
          <div className="admin-card admin-stat" key={label}>
            <span className="muted">{label}</span>
            <strong>{n}</strong>
          </div>
        ))}
      </div>
      <div className="admin-card">
        <h2>Recently updated</h2>
        {menu.dishes
          .filter((d) => d.updatedAt)
          .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))
          .slice(0, 6)
          .map((d) => (
            <div className="admin-row" key={d.id}>
              <div className="grow">
                <strong>{d.name}</strong>
                <small>{new Date(d.updatedAt!).toLocaleString()}</small>
              </div>
              <button onClick={() => onEdit(d)}>Edit</button>
            </div>
          ))}
        {!menu.dishes.some((d) => d.updatedAt) && (
          <p className="admin-empty">
            Your original menu is ready. Open Menu to start editing.
          </p>
        )}
        <button onClick={() => onMenu()}>Manage menu →</button>
      </div>
    </>
  );
}
