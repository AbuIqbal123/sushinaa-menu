"use client";
import { useId, useState } from "react";
import { kindLabels } from "./pricing";
import {
  TextField,
  Check,
  ImageField,
  MoveButtons,
  moveEntry,
  FieldError,
} from "./Fields";
// One typed field description drives repeated option forms; administrators never edit JSON.
type Value =
  string | number | boolean | undefined | Record<string, unknown> | unknown[];
type Row = Record<string, Value>;
type Field = {
  key: string;
  label: string;
  type?: "number" | "check" | "image" | "prices" | "list" | "group";
  fields?: Field[];
  optional?: boolean;
  create?: () => Row;
};
const named: Field[] = [
  { key: "id", label: "Stable ID" },
  { key: "name", label: "Name (English)" },
  { key: "nameAr", label: "Name (Arabic)" },
];
const choiceFields: Field[] = [
  ...named,
  { key: "image", label: "Option photo", type: "image", optional: true },
  { key: "spicy", label: "Spicy", type: "check" },
  { key: "veg", label: "Vegetarian", type: "check" },
];
const extraFields: Field[] = [
  ...named,
  { key: "priceQar", label: "Additional price", type: "number" },
];
const newChoice = () => ({ id: "", name: "", nameAr: "" });
const list = (
  key: string,
  label: string,
  fields: Field[] = choiceFields,
  optional = false,
): Field => ({
  key,
  label,
  type: "list",
  fields,
  optional,
  create: () => ({
    ...newChoice(),
    ...(fields === extraFields ? { priceQar: 0 } : {}),
  }),
});
const group = (key: string, label: string): Field => ({
  key,
  label,
  type: "group",
  optional: true,
  fields: [...named, list("options", "Choices")],
  create: () => ({
    id: key === "flavors" ? "flavor" : key,
    name: "",
    nameAr: "",
    options: [newChoice()],
  }),
});
const basePrice: Field = {
  key: "priceQar",
  label: "Base price",
  type: "number",
};
function newKind(type: string): Row {
  switch (type) {
    case "simple":
      return { type, priceQar: 0 };
    case "spicy-toggle":
      return { type, mildQar: 0, spicyQar: 0 };
    case "sauce-price":
      return { type, sauces: [{ ...newChoice(), priceQar: 0 }] };
    case "roll":
      return { type, proteins: [{ ...newChoice(), prices: { 6: 0 } }] };
    case "deal-box":
      return {
        type,
        priceQar: 0,
        starters: [newChoice()],
        sushi: [newChoice()],
      };
    case "party-box":
      return {
        type,
        priceQar: 0,
        starterMin: 1,
        starterMax: 1,
        starters: [newChoice()],
      };
    case "size-price":
      return { type, sizes: [{ ...newChoice(), priceQar: 0 }] };
    default:
      return { type: "addons", priceQar: 0, extras: [] };
  }
}
function kindFields(type: string): Field[] {
  switch (type) {
    case "simple":
      return [basePrice];
    case "spicy-toggle":
      return [
        { key: "mildQar", label: "Regular price", type: "number" },
        { key: "spicyQar", label: "Spicy price", type: "number" },
      ];
    case "sauce-price":
      return [
        list("sauces", "Sauce prices", [
          ...named,
          { key: "priceQar", label: "Price", type: "number" },
          { key: "spicy", label: "Spicy", type: "check" },
        ]),
      ];
    case "roll":
      return [
        {
          ...list("proteins", "Proteins", [
            ...choiceFields,
            { key: "seafood", label: "Seafood", type: "check" },
            { key: "prices", label: "Portion prices", type: "prices" },
          ]),
          create: () => ({ ...newChoice(), prices: { 6: 0 } }),
        },
        group("topping", "Topping / filling"),
        group("style", "Style"),
      ];
    case "deal-box":
      return [
        basePrice,
        list("starters", "Starters"),
        list("sushi", "Sushi choices"),
      ];
    case "party-box":
      return [
        basePrice,
        { key: "starterMin", label: "Minimum starters", type: "number" },
        {
          key: "starterMax",
          label: "Maximum starters (repeats allowed)",
          type: "number",
        },
        list("starters", "Starters"),
      ];
    case "size-price":
      return [
        list("sizes", "Sizes", extraFields),
        group("flavors", "Flavours"),
      ];
    default:
      return [
        basePrice,
        {
          key: "spicyOptional",
          label: "Offer regular / spicy choice",
          type: "check",
        },
        list("extras", "Paid add-ons", extraFields),
        {
          key: "freeChoices",
          label: "Free option groups",
          type: "list",
          optional: true,
          fields: [
            { key: "id", label: "Choice type" },
            ...named.filter((f) => f.key !== "id"),
            list("options", "Choices"),
          ],
          create: () => ({
            id: "cut",
            name: "",
            nameAr: "",
            options: [newChoice()],
          }),
        },
        {
          key: "includedPicks",
          label: "Included choices",
          type: "group",
          optional: true,
          fields: [
            { key: "name", label: "Group name (English)" },
            { key: "nameAr", label: "Group name (Arabic)" },
            { key: "min", label: "Minimum selections", type: "number" },
            {
              key: "max",
              label: "Maximum selections (repeats allowed)",
              type: "number",
            },
            list("options", "Choices"),
          ],
          create: () => ({
            name: "",
            nameAr: "",
            min: 0,
            max: 1,
            options: [newChoice()],
          }),
        },
      ];
  }
}
function ObjectFields({
  value,
  fields,
  onChange,
  path,
}: {
  value: Row;
  fields: Field[];
  onChange: (v: Row) => void;
  path: string; // where this object sits in the dish, for field errors
}) {
  const at = (key: string | number) => (path ? `${path}.${key}` : `${key}`);
  const set = (key: string, v: Value) => {
    const next = { ...value };
    if (v === undefined) delete next[key];
    else next[key] = v;
    onChange(next);
  };
  return (
    <div className="admin-fields">
      {fields.map((f) => {
        const val = value[f.key];
        if (f.key === "id") {
          if (f.label !== "Choice type") return null;
          return (
            <label className="admin-field" key={f.key}>
              Choice type
              <select
                value={String(val)}
                onChange={(e) => set(f.key, e.target.value)}
              >
                {[
                  ["cut", "Cut"],
                  ["style", "Style"],
                  ["topping", "Topping / filling"],
                  ["dip", "Dip"],
                ].map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          );
        }

        if (f.type === "check")
          return (
            <Check
              key={f.key}
              label={f.label}
              value={Boolean(val)}
              onChange={(v) => set(f.key, v)}
            />
          );
        if (f.type === "image")
          return (
            <ImageField
              key={f.key}
              label={f.label}
              value={val as string}
              optional
              path={at(f.key)}
              onChange={(v) => set(f.key, v)}
            />
          );
        if (f.type === "prices") {
          const prices = (val || {}) as Record<string, number>;
          return (
            <fieldset className="admin-fieldset" key={f.key}>
              <legend>{f.label}</legend>
              <small>
                Leave a portion blank to remove it. At least one price is
                required.
              </small>
              <FieldError path={at(f.key)} />
              <div className="admin-grid">
                {[4, 6, 8, 12, 24].map((n) => (
                  <TextField
                    key={n}
                    label={`${n} pieces`}
                    type="number"
                    path={`${at(f.key)}.${n}`}
                    value={prices[n] ?? ""}
                    onChange={(s) => {
                      const next = { ...prices };
                      if (s === "") delete next[n];
                      else next[n] = Number(s);
                      set(f.key, next);
                    }}
                  />
                ))}
              </div>
            </fieldset>
          );
        }
        if (f.type === "group" || f.type === "list") {
          const enabled = val !== undefined;
          return (
            <fieldset className="admin-fieldset" key={f.key}>
              <legend>{f.label}</legend>
              <FieldError path={at(f.key)} />
              {!enabled ? (
                <button
                  type="button"
                  onClick={() =>
                    set(f.key, f.type === "list" ? [] : f.create?.() || {})
                  }
                >
                  Add {f.label.toLowerCase()}
                </button>
              ) : (
                <>
                  {f.optional && (
                    <button
                      className="danger"
                      type="button"
                      onClick={() => {
                        if (confirm(`Remove ${f.label} and its options?`))
                          set(f.key, undefined);
                      }}
                    >
                      Remove group
                    </button>
                  )}
                  {f.key === "freeChoices" && (
                    <p className="muted">
                      Group IDs must be cut, style, topping or dip; use each
                      only once.
                    </p>
                  )}
                  {f.type === "group" ? (
                    <ObjectFields
                      value={val as Row}
                      fields={f.fields || []}
                      path={at(f.key)}
                      onChange={(v) => set(f.key, v)}
                    />
                  ) : (
                    <>
                      {(val as Row[]).map((row, i, rows) => (
                        <div className="admin-list-entry" key={i}>
                          <header>
                            <strong>
                              {String(row.name || `Choice ${i + 1}`)}
                            </strong>
                            <div className="admin-actions">
                              <MoveButtons
                                index={i}
                                length={rows.length}
                                label={String(row.name || "choice")}
                                move={(to) =>
                                  set(f.key, moveEntry(rows, i, to))
                                }
                              />
                              <button
                                type="button"
                                className="danger"
                                onClick={() => {
                                  if (confirm("Delete this choice?"))
                                    set(
                                      f.key,
                                      rows.filter((_, n) => n !== i),
                                    );
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </header>
                          <ObjectFields
                            value={row}
                            fields={f.fields || []}
                            path={`${at(f.key)}.${i}`}
                            onChange={(v) =>
                              set(
                                f.key,
                                rows.map((r, n) => (n === i ? v : r)),
                              )
                            }
                          />
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          set(f.key, [
                            ...(val as Row[]),
                            f.create?.() || newChoice(),
                          ])
                        }
                      >
                        Add choice
                      </button>
                    </>
                  )}
                </>
              )}
            </fieldset>
          );
        }
        return (
          <TextField
            key={f.key}
            label={f.label}
            type={f.type === "number" ? "number" : "text"}
            lang={f.key.endsWith("Ar") ? "ar" : undefined}
            path={at(f.key)}
            value={(val ?? "") as string | number}
            onChange={(s) =>
              set(
                f.key,
                f.type === "number" ? (s === "" ? undefined : Number(s)) : s,
              )
            }
          />
        );
      })}
    </div>
  );
}
export function OptionsEditor({
  value,
  onChange,
  example,
}: {
  value: Row;
  onChange: (v: Row) => void;
  example: (type: string) => string;
}) {
  const current = String(value.type) as keyof typeof kindLabels;
  // A kind picked but not yet confirmed; the select shows it meanwhile.
  const [pending, setPending] = useState<keyof typeof kindLabels | null>(null);
  const hint = useId();
  const shown = pending ?? current;
  return (
    <>
      <label className="admin-field">
        How it’s priced
        <select
          aria-describedby={hint}
          value={shown}
          onChange={(e) => {
            const next = e.target.value as keyof typeof kindLabels;
            // Untouched options (e.g. a new item) switch at once; edited ones ask.
            const untouched =
              JSON.stringify(value) === JSON.stringify(newKind(current));
            if (next === current || untouched) {
              if (next !== current) onChange(newKind(next));
              setPending(null);
            } else setPending(next);
          }}
        >
          {Object.entries(kindLabels).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <small id={hint} className="admin-hint">
        {example(shown)}
      </small>
      {pending && (
        <div className="admin-confirm" role="alert">
          <span>
            Switching to {kindLabels[pending]} replaces this item’s current
            options.
          </span>
          <div className="admin-actions">
            <button
              type="button"
              className="primary"
              onClick={() => {
                onChange(newKind(pending));
                setPending(null);
              }}
            >
              Switch
            </button>
            <button type="button" onClick={() => setPending(null)}>
              Keep current
            </button>
          </div>
        </div>
      )}
      <ObjectFields
        value={value}
        fields={kindFields(String(value.type))}
        path="kind"
        onChange={onChange}
      />
    </>
  );
}
export function OtherOptions({
  value,
  onChange,
}: {
  value: Row;
  onChange: (v: Row) => void;
}) {
  return (
    <ObjectFields
      value={value}
      fields={[
        list("extras", "Additional extras", extraFields, true),
        list("freeDips", "Free dip choices", choiceFields, true),
      ]}
      path=""
      onChange={onChange}
    />
  );
}
