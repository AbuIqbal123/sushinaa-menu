"use client";
import { useRef, useState } from "react";
import { dishSchema, type CmsDish, type Category } from "@/cms/schema";
import { fieldErrors } from "@/cms/issues";
import { pricingExample } from "./pricing";
import {
  TextField,
  Check,
  ImageField,
  Tabs,
  useModal,
  useUnsaved,
  confirmDiscard,
  saveShortcut,
  FieldErrors,
  SaveNote,
  focusFirstInvalid,
} from "./Fields";
import { OptionsEditor, OtherOptions } from "./OptionsEditor";
import { fillIds, uniqueId } from "@/cms/ids";
export function ItemEditor({
  item,
  categories,
  dishes,
  currency,
  onSave,
  onClose,
}: {
  item: CmsDish;
  categories: Category[];
  dishes: CmsDish[];
  currency: string;
  onSave: (d: CmsDish) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(structuredClone(item));
  const [tab, setTab] = useState("Details");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // After the first blocked save, errors track the draft live and clear as fixed.
  const [checked, setChecked] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useModal(dialog);
  const dirty = JSON.stringify(draft) !== JSON.stringify(item);
  useUnsaved(dirty);
  const validate = () => {
    const ready = fillIds(draft);
    if (!ready.id)
      ready.id = uniqueId(
        ready.name,
        dishes.map((d) => d.id),
      );
    return dishSchema.safeParse(ready);
  };
  const errors = checked ? errorsOf(validate()) : {};
  const tabsWithErrors = [...new Set(Object.keys(errors).map(tabOf))];
  const close = () => {
    if (!busy && confirmDiscard()) onClose();
  };
  const patch = (v: Partial<CmsDish>) => setDraft((d) => ({ ...d, ...v }));
  return (
    <dialog
      ref={dialog}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      aria-labelledby="editor-title"
    >
      <form
        onKeyDown={saveShortcut}
        onSubmit={async (e) => {
          e.preventDefault();
          const result = validate();
          if (!result.success) {
            setChecked(true);
            setError("");
            setTab(tabOf(Object.keys(errorsOf(result))[0]));
            focusFirstInvalid(dialog.current);
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
            setError(
              `Couldn’t save: ${e instanceof Error ? e.message : "the server didn’t respond"}. Your edits are still here.`,
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <header className="admin-dialog-head">
          <h2 id="editor-title">{item.name || "New menu item"}</h2>
          <button type="button" disabled={busy} onClick={close}>
            Close
          </button>
        </header>
        <FieldErrors value={errors}>
          <div className="admin-dialog-body">
            <Tabs
              tabs={["Details", "Images", "Options"]}
              value={tab}
              onChange={setTab}
            />
            {tab === "Details" && (
              <>
                <div className="admin-grid">
                  <TextField
                    label="Name (English)"
                    path="name"
                    value={draft.name}
                    onChange={(name) => patch({ name })}
                  />
                  <TextField
                    label="Name (Arabic)"
                    path="nameAr"
                    lang="ar"
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
                  path="description"
                  multiline
                  value={draft.description}
                  onChange={(description) => patch({ description })}
                />
                <TextField
                  label="Description (Arabic)"
                  path="descriptionAr"
                  lang="ar"
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
                        {
                          veg: "Vegetarian",
                          spicy: "Spicy",
                          seafood: "Seafood",
                        }[tag]
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
                    path="piecesNote"
                    value={draft.piecesNote}
                    onChange={(piecesNote) => patch({ piecesNote })}
                  />
                )}
              </>
            )}
            {tab === "Images" && (
              <>
                <ImageField
                  label="Photo"
                  path="image"
                  value={draft.image}
                  onChange={(image) => patch({ image: image || "" })}
                />
                <TextField
                  label="Image description (English, optional)"
                  path="imageAlt"
                  value={draft.imageAlt}
                  onChange={(imageAlt) => patch({ imageAlt })}
                />
                <TextField
                  label="Image description (Arabic, optional)"
                  path="imageAltAr"
                  lang="ar"
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
                  example={(type) =>
                    pricingExample(type, dishes, currency, item.id)
                  }
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
        </FieldErrors>
        <footer className="admin-dialog-foot">
          <SaveNote
            errors={errors}
            where={tabsWithErrors.join(" and ")}
            loose={["", "kind"]}
            dirty={dirty}
            idle="Saved changes appear on the public menu."
          />
          <button className="primary" disabled={busy}>
            {busy ? "Saving…" : "Save item"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}

const errorsOf = (r: ReturnType<typeof dishSchema.safeParse>) =>
  r.success ? {} : fieldErrors(r.error.issues);
// Which editor tab holds the field at this path.
function tabOf(path: string) {
  const key = path.split(".")[0];
  if (["image", "imageAlt", "imageAltAr"].includes(key)) return "Images";
  if (["kind", "extras", "freeDips"].includes(key)) return "Options";
  return "Details";
}
