"use client";
import { useEffect, useRef, useState } from "react";
import { dishSchema, type CmsDish, type Category } from "@/cms/schema";
import { TextField, Check, ImageField } from "./Fields";
import { OptionsEditor, OtherOptions } from "./OptionsEditor";
export function ItemEditor({
  item,
  categories,
  onSave,
  onClose,
}: {
  item: CmsDish;
  categories: Category[];
  onSave: (d: CmsDish) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(structuredClone(item));
  const [tab, setTab] = useState("Details");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const patch = (v: Partial<CmsDish>) => setDraft((d) => ({ ...d, ...v }));
  return (
    <dialog
      ref={dialog}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy && confirm("Discard unsaved changes?")) onClose();
      }}
      aria-labelledby="editor-title"
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const result = dishSchema.safeParse(draft);
          if (!result.success) {
            setError(
              result.error.issues
                .map((i) => `${i.path.join(".")}: ${i.message}`)
                .join("\n"),
            );
            return;
          }
          setBusy(true);
          setError("");
          try {
            await onSave({
              ...result.data,
              updatedAt: new Date().toISOString(),
            });
            onClose();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Unable to save");
          } finally {
            setBusy(false);
          }
        }}
      >
        <header className="admin-dialog-head">
          <h2 id="editor-title">{item.name || "New menu item"}</h2>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (confirm("Discard unsaved changes?")) onClose();
            }}
          >
            Close
          </button>
        </header>
        <div className="admin-dialog-body">
          <div className="admin-tabs">
            {["Details", "Images", "Options"].map((t) => (
              <button
                type="button"
                key={t}
                className={tab === t ? "active" : ""}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          {tab === "Details" && (
            <>
              <div className="admin-grid">
                <TextField
                  label="Name (English)"
                  value={draft.name}
                  onChange={(name) => patch({ name })}
                />
                <TextField
                  label="Name (Arabic)"
                  value={draft.nameAr}
                  onChange={(nameAr) => patch({ nameAr })}
                />
              </div>
              <label className="admin-field">
                Category
                <select
                  value={draft.section}
                  onChange={(e) => patch({ section: e.target.value })}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <TextField
                label="Description (English)"
                multiline
                value={draft.description}
                onChange={(description) => patch({ description })}
              />
              <TextField
                label="Description (Arabic)"
                multiline
                value={draft.descriptionAr || ""}
                onChange={(descriptionAr) => patch({ descriptionAr })}
              />
              <Check
                label="Visible on the menu"
                value={draft.visible}
                onChange={(visible) => patch({ visible })}
              />
              <Check
                label="Available to order"
                value={draft.available}
                onChange={(available) => patch({ available })}
              />
              <fieldset className="admin-fieldset">
                <legend>Dietary labels</legend>
                {(["veg", "spicy", "seafood"] as const).map((tag) => (
                  <Check
                    key={tag}
                    label={
                      { veg: "Vegetarian", spicy: "Spicy", seafood: "Seafood" }[
                        tag
                      ]
                    }
                    value={draft.tags.includes(tag)}
                    onChange={(v) =>
                      patch({
                        tags: v
                          ? [...draft.tags, tag]
                          : draft.tags.filter((t) => t !== tag),
                      })
                    }
                  />
                ))}
              </fieldset>
              {draft.piecesNote !== undefined && (
                <TextField
                  label="Portion note"
                  value={draft.piecesNote}
                  onChange={(piecesNote) => patch({ piecesNote })}
                />
              )}
              <p className="admin-locked">Stable ID: {draft.id}</p>
            </>
          )}
          {tab === "Images" && (
            <>
              <ImageField
                label="Primary image"
                value={draft.image}
                onChange={(image) => patch({ image: image || "" })}
              />
              <TextField
                label="Image description (English, optional)"
                value={draft.imageAlt}
                onChange={(imageAlt) => patch({ imageAlt })}
              />
              <TextField
                label="Image description (Arabic, optional)"
                value={draft.imageAltAr}
                onChange={(imageAltAr) => patch({ imageAltAr })}
              />
              <p className="muted">
                Protein and style photos are managed beside their choices in
                Options. Reorder those choices to control their presentation.
                The existing menu shows the photo for the selected variant.
              </p>
            </>
          )}
          {tab === "Options" && (
            <>
              <OptionsEditor
                value={draft.kind}
                onChange={(kind) => patch({ kind: kind as CmsDish["kind"] })}
              />
              {draft.kind.type !== "addons" && (
                <OtherOptions
                  value={draft}
                  onChange={(v) => setDraft(v as CmsDish)}
                />
              )}
            </>
          )}
          {error && (
            <p className="admin-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <footer className="admin-dialog-foot">
          <small>Saved changes appear on the public menu.</small>
          <button className="primary" disabled={busy}>
            {busy ? "Saving…" : "Save item"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
