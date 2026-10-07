"use client";
import { useState } from "react";
import type { MenuData } from "@/cms/schema";
import { TextField, ImageField, Check, MoveButtons, moveEntry } from "./Fields";
export function SettingsEditor({
  menu,
  onSave,
}: {
  menu: MenuData;
  onSave: (m: MenuData) => Promise<void>;
}) {
  const [draft, setDraft] = useState(structuredClone(menu));
  const [tab, setTab] = useState("Restaurant");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="admin-settings"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await onSave(draft);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Unable to save");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="admin-tabs">
        {["Restaurant", "Menu wording", "Filters"].map((t) => (
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
      {tab === "Restaurant" && (
        <div className="admin-card">
          {Object.entries(draft.settings).map(([key, value]) =>
            key === "logo" || key === "documentLogo" ? (
              <ImageField
                key={key}
                label={key === "logo" ? "Menu logo" : "Document logo"}
                value={value as string}
                onChange={(v) =>
                  setDraft({
                    ...draft,
                    settings: { ...draft.settings, [key]: v || "" },
                  })
                }
              />
            ) : (
              <TextField
                key={key}
                label={
                  key
                    .replace(/([A-Z])/g, " $1")
                    .replace(/^./, (s) => s.toUpperCase()) +
                  (Array.isArray(value) ? " (one per line)" : "")
                }
                value={Array.isArray(value) ? value.join("\n") : value}
                multiline={Array.isArray(value) || key === "addressLine"}
                lang={key.endsWith("Ar") ? "ar" : undefined}
                onChange={(v) =>
                  setDraft({
                    ...draft,
                    settings: {
                      ...draft.settings,
                      [key]: Array.isArray(value) ? v.split("\n") : v,
                    },
                  })
                }
              />
            ),
          )}
        </div>
      )}
      {tab === "Menu wording" && (
        <>
          <TextField label="Find wording" value={query} onChange={setQuery} />
          <p className="muted">
            Edit English and Arabic independently. Keep numbered placeholders
            such as {"{0}"} and {"{1}"} where the item name or count should
            appear.
          </p>
          {Object.keys(draft.copy.en)
            .filter((k) =>
              (k + draft.copy.en[k] + draft.copy.ar[k])
                .toLowerCase()
                .includes(query.toLowerCase()),
            )
            .map((key) => (
              <div key={key} className="admin-card">
                <h3>{key.replace(/([A-Z])/g, " $1")}</h3>
                <div className="admin-grid">
                  {(["en", "ar"] as const).map((lang) => (
                    <TextField
                      key={lang}
                      label={lang === "en" ? "English" : "Arabic"}
                      lang={lang === "ar" ? "ar" : undefined}
                      value={draft.copy[lang][key]}
                      multiline
                      onChange={(v) =>
                        setDraft({
                          ...draft,
                          copy: {
                            ...draft.copy,
                            [lang]: { ...draft.copy[lang], [key]: v },
                          },
                        })
                      }
                    />
                  ))}
                </div>
              </div>
            ))}
          <h2>Option field labels</h2>
          {Object.entries(draft.fields).map(([key, value]) => (
            <div className="admin-card admin-grid" key={key}>
              <TextField
                label={`${key} (English)`}
                value={value.name}
                onChange={(name) =>
                  setDraft({
                    ...draft,
                    fields: { ...draft.fields, [key]: { ...value, name } },
                  })
                }
              />
              <TextField
                label={`${key} (Arabic)`}
                lang="ar"
                value={value.nameAr}
                onChange={(nameAr) =>
                  setDraft({
                    ...draft,
                    fields: { ...draft.fields, [key]: { ...value, nameAr } },
                  })
                }
              />
            </div>
          ))}
        </>
      )}
      {tab === "Filters" && (
        <div className="admin-card">
          {draft.filters.map((f, i) => (
            <div className="admin-row" key={f.id}>
              <div className="grow">
                <Check
                  label={draft.copy.en[f.id]}
                  value={f.visible}
                  onChange={(visible) =>
                    setDraft({
                      ...draft,
                      filters: draft.filters.map((x) =>
                        x.id === f.id ? { ...x, visible } : x,
                      ),
                    })
                  }
                />
              </div>
              <MoveButtons
                index={i}
                length={draft.filters.length}
                label={f.id}
                move={(to) =>
                  setDraft({
                    ...draft,
                    filters: moveEntry(draft.filters, i, to).map(
                      (f, order) => ({ ...f, order }),
                    ),
                  })
                }
              />
            </div>
          ))}
        </div>
      )}
      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}
      <button className="primary" disabled={busy}>
        {busy ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
