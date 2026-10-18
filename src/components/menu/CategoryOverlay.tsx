"use client";

import { useEffect, useRef } from "react";
import type { PickerOption } from "./CategoryPicker";

export function CategoryOverlay({ open, title, label, closeLabel, logo, brand, options, value, onChange, onClose }: {
  open: boolean;
  title: string;
  label: string;
  closeLabel: string;
  logo: string;
  brand: string;
  options: PickerOption[];
  value: string;
  onChange: (id: string) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLButtonElement>('[aria-current="true"]')?.focus({ preventScroll: true });
    } else if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={dialogRef} id="category-overlay" className="category-overlay" aria-labelledby="category-overlay-title"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="category-overlay-content">
        <header className="category-overlay-header">
          <img src={logo} alt={brand} width={46} height={44} className="wordmark-img" />
          <button type="button" className="category-close cart-btn" aria-label={closeLabel} onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <div className="category-overlay-intro">
          <p>{label}</p>
          <h2 id="category-overlay-title">{title}</h2>
        </div>
        <nav className="category-grid" aria-label={label}>
          {options.map((option, index) => (
            <button key={option.id} type="button" className="category-tile" disabled={option.disabled}
              aria-current={option.id === value ? "true" : undefined}
              onClick={() => onChange(option.id)}>
              <span className="category-tile-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <span className="category-tile-name">{option.label}</span>
              <svg className="category-tile-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 12h14m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ))}
        </nav>
      </div>
    </dialog>
  );
}
