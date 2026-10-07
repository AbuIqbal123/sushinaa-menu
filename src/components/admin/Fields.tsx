"use client";
import { useState } from "react";
export function TextField({
  label,
  value,
  onChange,
  multiline = false,
  type = "text",
  disabled = false,
  lang,
}: {
  label: string;
  value: string | number;
  onChange: (s: string) => void;
  multiline?: boolean;
  type?: string;
  disabled?: boolean;
  lang?: "ar";
}) {
  // An Arabic field mirrors as a whole: label, caret and text run right to left.
  const dir = lang === "ar" ? "rtl" : undefined;
  return (
    <label className="admin-field" dir={dir}>
      <bdi>{label}</bdi>
      {multiline ? (
        <textarea
          aria-label={label}
          lang={lang}
          dir={dir}
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
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
}: {
  label: string;
  value?: string;
  onChange: (s: string | undefined) => void;
  optional?: boolean;
  preset?: { url: string; label: string };
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
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
