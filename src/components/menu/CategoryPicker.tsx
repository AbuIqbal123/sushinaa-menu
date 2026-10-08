"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

export type PickerOption = { id: string; label: string; disabled: boolean };

// A select-only combobox (WAI-ARIA APG): focus stays on the button and the
// active option is announced through aria-activedescendant.
export function CategoryPicker({ label, options, value, onChange }: {
  label: string;
  options: PickerOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  const id = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const selected = options.findIndex((o) => o.id === value);
  const enabled = options.flatMap((o, i) => (o.disabled ? [] : [i]));

  useEffect(() => {
    if (!open || active < 0) return;
    listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function show(index: number) {
    setActive(index);
    setOpen(true);
  }

  function choose(index: number) {
    setOpen(false);
    if (index >= 0 && !options[index].disabled && options[index].id !== value) onChange(options[index].id);
  }

  function step(delta: 1 | -1) {
    const at = enabled.indexOf(active);
    const next = at < 0 ? (delta > 0 ? enabled[0] : enabled.at(-1)) : enabled[at + delta];
    if (next !== undefined) setActive(next);
  }

  function onKeyDown(e: KeyboardEvent) {
    const first = enabled[0] ?? -1;
    const last = enabled.at(-1) ?? -1;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) show(selected >= 0 ? selected : first);
      else if (e.key === "Home") show(first);
      else if (e.key === "End") show(last);
      else return;
    } else if (e.key === "ArrowDown") step(1);
    else if (e.key === "ArrowUp") step(-1);
    else if (e.key === "Home") setActive(first);
    else if (e.key === "End") setActive(last);
    else if (e.key === "Enter" || e.key === " ") choose(active);
    else if (e.key === "Escape") setOpen(false);
    else if (e.key === "Tab") { choose(active); return; }
    else return;
    e.preventDefault();
    // Escape belongs to the picker while it is open.
    e.stopPropagation();
  }

  return (
    <div className={`category-picker${open ? " is-open" : ""}`}>
      <span id={`${id}-label`} className="sr-only">{label}</span>
      <div role="combobox" tabIndex={0} className="picker-button"
        aria-labelledby={`${id}-label`} aria-haspopup="listbox" aria-expanded={open}
        aria-controls={`${id}-list`} aria-activedescendant={open && active >= 0 ? `${id}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : show(selected))} onKeyDown={onKeyDown} onBlur={() => setOpen(false)}>
        <span className="picker-value">{options[selected]?.label}</span>
        <svg className="category-arrow" width="12" height="8" viewBox="0 0 12 8" fill="none" aria-hidden="true">
          <path d="m1 1 5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div ref={listRef} id={`${id}-list`} role="listbox" aria-labelledby={`${id}-label`} className="picker-list"
        tabIndex={-1} onPointerDown={(e) => e.preventDefault()}>
        {options.map((o, i) => (
          <div key={o.id} id={`${id}-${i}`} role="option" aria-selected={i === selected} aria-disabled={o.disabled || undefined}
            className={`picker-option${i === active ? " is-active" : ""}`}
            onPointerMove={(e) => { if (e.pointerType === "mouse" && !o.disabled) setActive(i); }}
            onClick={() => { if (!o.disabled) choose(i); }}>
            <span>{o.label}</span>
            <svg className="picker-check" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        ))}
      </div>
    </div>
  );
}
