"use client";
import { useState, useRef } from "react";
import { categorySchema, type Category } from "@/cms/schema";
import { fieldErrors } from "@/cms/issues";
import {
  TextField,
  Check,
  useModal,
  useUnsaved,
  confirmDiscard,
  saveShortcut,
  FieldErrors,
  SaveNote,
  focusFirstInvalid,
} from "./Fields";
import { categoryLimitIssues, LIMITS } from "@/cms/limits";
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
  const [checked, setChecked] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  useModal(ref);
  const dirty = JSON.stringify(draft) !== JSON.stringify(category);
  useUnsaved(dirty);
  const validate = () =>
    categorySchema
      .superRefine((c, ctx) => categoryLimitIssues(c, category).forEach((i) => ctx.addIssue(i)))
      .safeParse(draft.id ? draft : { ...draft, id: uniqueId(draft.name, taken) });
  const current = checked ? validate() : null;
  const errors =
    current && !current.success ? fieldErrors(current.error.issues) : {};
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
          const r = validate();
          if (!r.success) {
            setChecked(true);
            setError("");
            focusFirstInvalid(ref.current);
            return;
          }
          setBusy(true);
          setError("");
          try {
            await onSave(r.data);
            onClose();
          } catch (e) {
            setError(
              `Couldn’t save: ${e instanceof Error ? e.message : "the server didn’t respond"}. Your edits are still here.`,
            );
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
        <FieldErrors value={errors}>
          <div className="admin-dialog-body" style={{ paddingTop: 24 }}>
            <TextField
              label="Name (English)"
              path="name"
              limit={LIMITS.category.en}
              value={draft.name}
              onChange={(name) => setDraft({ ...draft, name })}
            />
            <TextField
              label="Name (Arabic)"
              path="nameAr"
              lang="ar"
              limit={LIMITS.category.ar}
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
        </FieldErrors>
        <footer className="admin-dialog-foot">
          <SaveNote
            errors={errors}
            loose={["", "id"]}
            dirty={dirty}
            idle="Items stay in this category when it is renamed."
          />
          <button className="primary" disabled={busy}>
            {busy ? "Saving…" : "Save category"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
