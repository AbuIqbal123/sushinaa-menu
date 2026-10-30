"use client";

import { useEffect, useRef, type ReactNode } from "react";

export type PickerOption = { id: string; label: string; disabled: boolean };

export function CategoryOverlay({ open, title, label, closeLabel, logo, brand, options, value, filters, onChange, onClose }: {
  open: boolean;
  title: string;
  label: string;
  closeLabel: string;
  logo: string;
  brand: string;
  options: PickerOption[];
  value: string;
  filters: ReactNode;
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
          <img src={logo} alt={brand} width={38} height={36} className="wordmark-img" />
          <h2 id="category-overlay-title">{title}</h2>
          <button type="button" className="category-close cart-btn" aria-label={closeLabel} onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        {filters}
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
