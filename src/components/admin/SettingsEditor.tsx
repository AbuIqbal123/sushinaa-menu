"use client";
import { useState } from "react";
import { menuSchema, type MenuData } from "@/cms/schema";
import { fieldErrors } from "@/cms/issues";
import {
  TextField,
  ImageField,
  Check,
  MoveButtons,
  moveEntry,
  Tabs,
  useUnsaved,
  saveShortcut,
  FieldErrors,
  SaveNote,
  focusFirstInvalid,
} from "./Fields";
const settingLabels: Record<string, string> = {
  name: "Restaurant name (English)",
  nameAr: "Restaurant name (Arabic)",
  tagline: "Tagline",
  url: "Website address",
  whatsappE164: "WhatsApp number (digits with country code)",
  whatsappDisplay: "WhatsApp number as shown",
  instagram: "Instagram link",
  instagramHandle: "Instagram handle",
  country: "Country",
  founded: "Year founded",
  areas: "Delivery areas (one per line)",
  areasAr: "Delivery areas in Arabic (one per line)",
  addressLine: "Address",
  currencyEn: "Currency (English)",
  currencyAr: "Currency (Arabic)",
};
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
  const [checked, setChecked] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(menu);
  useUnsaved(dirty);
  const validate = () => menuSchema.safeParse(draft);
  const errorsOf = (r: ReturnType<typeof validate>) =>
    r.success ? {} : fieldErrors(r.error.issues);
  const errors = checked ? errorsOf(validate()) : {};
  return (
    <form
      className="admin-settings"
      onKeyDown={saveShortcut}
      onSubmit={async (e) => {
        e.preventDefault();
        const result = validate();
        if (!result.success) {
          setChecked(true);
          setError("");
          setQuery("");
          setTab(tabOf(Object.keys(errorsOf(result))[0]));
          focusFirstInvalid(e.currentTarget);
          return;
        }
        setBusy(true);
        setError("");
        try {
          await onSave(draft);
        } catch (e) {
          setError(
            `Couldn’t save: ${e instanceof Error ? e.message : "the server didn’t respond"}. Your edits are still here.`,
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <FieldErrors value={errors}>
        <Tabs
          tabs={["Restaurant", "Menu wording", "Filters"]}
          value={tab}
          onChange={setTab}
        />
        {tab === "Restaurant" && (
          <div className="admin-card">
            {Object.entries(draft.settings).map(([key, value]) =>
              key === "logo" || key === "documentLogo" ? (
                <ImageField
                  key={key}
                  label={key === "logo" ? "Menu logo" : "Document logo"}
                  path={`settings.${key}`}
                  preset={{
                    url: "/brand/logo.svg",
                    label: "Use the Sushinaa logo",
                  }}
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
                  label={settingLabels[key] ?? key}
                  path={`settings.${key}`}
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
                        path={`copy.${lang}.${key}`}
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
                  path={`fields.${key}.name`}
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
                  path={`fields.${key}.nameAr`}
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
      </FieldErrors>
      <div className="admin-savebar">
        {error && (
          <p className="admin-error" role="alert">
            {error}
          </p>
        )}
        <button className="primary" disabled={busy}>
          {busy ? "Saving…" : "Save settings"}
        </button>
        <SaveNote
          errors={errors}
          loose={["", "settings", "copy"]}
          dirty={dirty}
          idle="All changes saved"
        />
      </div>
    </form>
  );
}
// Which settings tab holds the field at this path.
function tabOf(path: string) {
  if (path.startsWith("filters")) return "Filters";
  if (path.startsWith("copy") || path.startsWith("fields"))
    return "Menu wording";
  return "Restaurant";
}
