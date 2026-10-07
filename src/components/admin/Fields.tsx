"use client";
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useState,
  type KeyboardEvent,
  type RefObject,
} from "react";
// Field-level validation messages, keyed by dotted path ("kind.sauces.0.name").
export const FieldErrors = createContext<Record<string, string>>({});
export function FieldError({ path, id }: { path: string; id?: string }) {
  const message = useContext(FieldErrors)[path];
  return message ? (
    <small className="admin-field-error" id={id}>
      {message}
    </small>
  ) : null;
}
// The note beside a save button: what blocks the save, else whether there
// are unsaved edits. Messages without a field of their own (e.g. "kind") are
// spelled out here.
export function SaveNote({
  errors,
  where,
  loose = [],
  dirty,
  idle,
}: {
  errors: Record<string, string>;
  where?: string;
  loose?: string[];
  dirty: boolean;
  idle: string;
}) {
  const n = Object.keys(errors).length;
  if (!n) return <small>{dirty ? "Unsaved changes" : idle}</small>;
  const extra = loose.filter((k) => errors[k]).map((k) => errors[k]);
  return (
    <small className="admin-field-error" role="alert">
      Fix {n === 1 ? "the marked field" : `${n} marked fields`}
      {where ? ` in ${where}` : ""}. {extra.join(" ")}
    </small>
  );
}
// Focus the first invalid control after a blocked save.
export function focusFirstInvalid(root: HTMLElement | null) {
  requestAnimationFrame(() =>
    root?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
  );
}
// Props that tie a control to its message for assistive tech.
function useInvalid(path?: string) {
  const id = useId();
  const errors = useContext(FieldErrors);
  const invalid = Boolean(path && errors[path]);
  return {
    id,
    props: invalid
      ? { "aria-invalid": true as const, "aria-describedby": id }
      : {},
  };
}
// Open a <dialog> modally; on unmount, return focus to whatever opened it.
export function useModal(ref: RefObject<HTMLDialogElement | null>) {
  const [opener] = useState(() => document.activeElement as HTMLElement | null);
  useEffect(() => {
    ref.current?.showModal();
    return () => opener?.focus();
  }, [ref, opener]);
}
// Editors with unsaved edits register here: the page warns before unloading,
// and confirmDiscard() asks before an in-app close or navigation drops them.
let unsaved = 0;
export function useUnsaved(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    unsaved++;
    addEventListener("beforeunload", warn);
    return () => {
      unsaved--;
      removeEventListener("beforeunload", warn);
    };
  }, [dirty]);
}
export const confirmDiscard = () =>
  unsaved === 0 || confirm("Discard unsaved changes?");
// Cmd/Ctrl+S saves the form instead of the browser's "Save page".
export function saveShortcut(e: KeyboardEvent<HTMLFormElement>) {
  if (e.key === "s" && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    e.currentTarget.requestSubmit();
  }
}
export function TextField({
  label,
  value,
  onChange,
  multiline = false,
  type = "text",
  disabled = false,
  lang,
  path,
}: {
  label: string;
  value: string | number;
  onChange: (s: string) => void;
  multiline?: boolean;
  type?: string;
  disabled?: boolean;
  lang?: "ar";
  path?: string;
}) {
  // An Arabic field mirrors as a whole: label, caret and text run right to left.
  const dir = lang === "ar" ? "rtl" : undefined;
  const invalid = useInvalid(path);
  return (
    <label className="admin-field" dir={dir}>
      <bdi>{label}</bdi>
      {multiline ? (
        <textarea
          {...invalid.props}
          aria-label={label}
          lang={lang}
          dir={dir}
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          {...invalid.props}
          aria-label={label}
          lang={lang}
          dir={dir}
          type={type}
          step={type === "number" ? "0.01" : undefined}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {path && <FieldError path={path} id={invalid.id} />}
    </label>
  );
}
export function Check({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (b: boolean) => void;
}) {
  return (
    <label className="check admin-field">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}
export function ImageField({
  label,
  value,
  onChange,
  optional = false,
  preset,
  path,
}: {
  label: string;
  value?: string;
  onChange: (s: string | undefined) => void;
  optional?: boolean;
  preset?: { url: string; label: string };
  path?: string;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const invalid = useInvalid(path);
  return (
    <fieldset className="admin-field admin-image-field">
      <legend>{label}</legend>
      <div className="admin-image">
        {value ? (
          <img src={value} alt="" />
        ) : (
          <span className="muted">No photo</span>
        )}
        <label className="admin-upload">
          {value ? "Replace" : "Upload"}
          <input
            {...invalid.props}
            type="file"
            aria-label={label}
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            onChange={async (e) => {
              const input = e.currentTarget;
              const file = input.files?.[0];
              if (!file) return;
              setBusy(true);
              setError("");
              try {
                const form = new FormData();
                form.set("file", file);
                const r = await fetch("/api/admin/media", {
                  method: "POST",
                  body: form,
                });
                const data = await r.json();
                if (!r.ok) throw new Error(data.error);
                onChange(data.url);
              } catch (e) {
                setError(e instanceof Error ? e.message : "Upload failed");
              } finally {
                input.value = "";
                setBusy(false);
              }
            }}
          />
        </label>
        {optional && value && (
          <button
            type="button"
            onClick={() => {
              if (
                confirm(
                  "Remove this image? The primary dish image will be used instead.",
                )
              )
                onChange(undefined);
            }}
          >
            Remove
          </button>
        )}
        {preset && value !== preset.url && (
          <button type="button" onClick={() => onChange(preset.url)}>
            {preset.label}
          </button>
        )}
      </div>
      {path && <FieldError path={path} id={invalid.id} />}
      {busy && <small role="status">Uploading…</small>}
      {error && (
        <p role="alert" className="admin-error">
          {error}
        </p>
      )}
      <small>JPEG, PNG or WebP, up to 5 MB.</small>
    </fieldset>
  );
}
// Underline-on-active tabs with tablist semantics and arrow/Home/End keys.
export function Tabs({
  tabs,
  value,
  onChange,
}: {
  tabs: string[];
  value: string;
  onChange: (t: string) => void;
}) {
  return (
    <div className="admin-tabs" role="tablist">
      {tabs.map((t, i) => (
        <button
          type="button"
          role="tab"
          key={t}
          aria-selected={t === value}
          tabIndex={t === value ? 0 : -1}
          onClick={() => onChange(t)}
          onKeyDown={(e) => {
            const last = tabs.length - 1;
            const to = {
              ArrowRight: i === last ? 0 : i + 1,
              ArrowLeft: i === 0 ? last : i - 1,
              Home: 0,
              End: last,
            }[e.key];
            if (to === undefined) return;
            e.preventDefault();
            onChange(tabs[to]);
            (
              e.currentTarget.parentElement?.children[to] as HTMLElement
            )?.focus();
          }}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
export function MoveButtons({
  index,
  length,
  move,
  label,
}: {
  index: number;
  length: number;
  move: (to: number) => void;
  label: string;
}) {
  return (
    <>
      <button
        type="button"
        aria-label={`Move ${label} up`}
        disabled={index === 0}
        onClick={() => move(index - 1)}
      >
        ↑
      </button>
      <button
        type="button"
        aria-label={`Move ${label} down`}
        disabled={index === length - 1}
        onClick={() => move(index + 1)}
      >
        ↓
      </button>
    </>
  );
}
export function moveEntry<T>(list: T[], from: number, to: number) {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
