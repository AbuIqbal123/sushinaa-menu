"use client";
import { useState, useRef } from "react";
import { categorySchema, type Category } from "@/cms/schema";
import {
  TextField,
  Check,
  useModal,
  useUnsaved,
  confirmDiscard,
  saveShortcut,
} from "./Fields";
import { uniqueId } from "@/cms/ids";
export function CategoryEditor({
  category,
  taken,
  onClose,
  onSave,
}: {
  category: Category;
  taken: string[];
  onClose: () => void;
  onSave: (c: Category) => Promise<void>;
}) {
  const [draft, setDraft] = useState(category);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  useModal(ref);
  useUnsaved(JSON.stringify(draft) !== JSON.stringify(category));
  const close = () => {
    if (!busy && confirmDiscard()) onClose();
  };
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      aria-labelledby="category-title"
    >
      <form
        onKeyDown={saveShortcut}
        onSubmit={async (e) => {
          e.preventDefault();
          const r = categorySchema.safeParse(
            draft.id ? draft : { ...draft, id: uniqueId(draft.name, taken) },
          );
          if (!r.success) {
            setError(r.error.issues.map((i) => i.message).join("\n"));
            return;
          }
          setBusy(true);
          try {
            await onSave(r.data);
            onClose();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Unable to save");
          } finally {
            setBusy(false);
          }
        }}
      >
        <header className="admin-dialog-head">
          <h2 id="category-title">{category.name || "New category"}</h2>
          <button type="button" disabled={busy} onClick={close}>
            Close
          </button>
        </header>
        <div className="admin-dialog-body" style={{ paddingTop: 24 }}>
          <TextField
            label="Name (English)"
            value={draft.name}
            onChange={(name) => setDraft({ ...draft, name })}
          />
          <TextField
            label="Name (Arabic)"
            lang="ar"
            value={draft.nameAr || ""}
            onChange={(nameAr) => setDraft({ ...draft, nameAr })}
          />
          <Check
            label="Visible on the menu"
            value={draft.visible}
            onChange={(visible) => setDraft({ ...draft, visible })}
          />
          <Check
            label="Highlight as new on the menu"
            value={draft.featured}
            onChange={(featured) => setDraft({ ...draft, featured })}
          />
          {error && (
            <p role="alert" className="admin-error">
              {error}
            </p>
          )}
        </div>
        <footer className="admin-dialog-foot">
          <small>
            Items retain their relationship when a category is renamed.
          </small>
          <button className="primary" disabled={busy}>
            {busy ? "Saving…" : "Save category"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
