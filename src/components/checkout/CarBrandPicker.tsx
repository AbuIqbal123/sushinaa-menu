'use client';

import { useEffect, useRef, useState } from 'react';
import { carBrandName, findCarBrand, searchCarBrands, type CarBrand } from '@/ordering/car-brands';
import type { Lang } from '@/i18n/localize';
import { useSetSheetOpen } from '@/i18n/locale';

function BrandLogo({ brand }: { brand?: CarBrand }) {
  return <span className="car-brand-logo" aria-hidden="true">{brand?.sprite ? <span style={{
    backgroundImage: `url(/car-brands/reference-${brand.sprite}.jpg)`,
    backgroundPosition: `-17px ${-(brand.y - 44) / 2}px`,
  }} /> : <svg width="25" height="25" viewBox="0 0 24 24" fill="none"><path d="m5 9 2-5h10l2 5M4 9h16a1 1 0 0 1 1 1v7H3v-7a1 1 0 0 1 1-1ZM5 17v3m14-3v3M6 13h2m8 0h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}</span>;
}

export function CarBrandPicker({ value, lang, invalid, onChange }: { value: string; lang: Lang; invalid: boolean; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const brand = findCarBrand(value);
  const ar = lang === 'ar';
  return <div className="checkout-field field-brand">
    <label id="collection-brand-label" htmlFor="collection-brand">{ar ? 'ماركة السيارة' : 'Car brand'}</label>
    <button id="collection-brand" type="button" role="combobox" aria-required="true" className={`car-brand-trigger${brand ? ' has-value' : ''}`} aria-labelledby="collection-brand-label collection-brand-value" aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? 'car-brand-dialog' : undefined} aria-invalid={invalid} aria-describedby={invalid ? 'hint-brand' : undefined} onKeyDown={event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); } }} onClick={() => setOpen(true)}>
      <BrandLogo brand={brand} /><span id="collection-brand-value">{brand ? carBrandName(brand.id, lang) : ar ? 'اختر ماركة السيارة' : 'Select car brand'}</span><svg className="car-brand-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m9 5 7 7-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
    {invalid && <small id="hint-brand" className="field-error">{ar ? 'يرجى اختيار ماركة السيارة.' : 'Please select your car brand.'}</small>}
    {open && <BrandDialog value={value} lang={lang} onPick={id => { onChange(id); setOpen(false); }} onClose={() => setOpen(false)} />}
  </div>;
}

function BrandDialog({ value, lang, onPick, onClose }: { value: string; lang: Lang; onPick: (id: string) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState('');
  const setSheetOpen = useSetSheetOpen();
  const ar = lang === 'ar';
  const brands = searchCarBrands(query);
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setSheetOpen(true); node.showModal();
    return () => { node.close(); document.body.style.overflow = overflow; setSheetOpen(false); if (trigger?.isConnected) trigger.focus({ preventScroll: true }); };
  }, [setSheetOpen]);
  return <dialog ref={dialog} id="car-brand-dialog" className="car-brand-dialog" dir={ar ? 'rtl' : 'ltr'} aria-labelledby="car-brand-title" onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); } }} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="car-brand-panel">
      <span className="car-brand-handle" aria-hidden="true" />
      <header className="car-brand-header"><h2 id="car-brand-title">{ar ? 'اختر ماركة السيارة' : 'Select car brand'}</h2><button type="button" className="car-brand-close" aria-label={ar ? 'إغلاق' : 'Close'} onClick={onClose}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg></button></header>
      <div className="car-brand-search"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.5" /><path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg><input type="search" onKeyDown={event => { if (event.key === 'Enter') event.preventDefault(); }} value={query} maxLength={80} onChange={e => setQuery(e.target.value)} placeholder={ar ? 'ابحث عن ماركة' : 'Search for a brand'} aria-label={ar ? 'ابحث عن ماركة' : 'Search for a brand'} /></div>
      <ul className="car-brand-list" aria-label={ar ? 'ماركات السيارات' : 'Car brands'}>{brands.map(brand => <li key={brand.id}><button type="button" className="car-brand-option" data-brand-id={brand.id} aria-pressed={brand.id === value} onClick={() => onPick(brand.id)}><BrandLogo brand={brand} /><span className="car-brand-name">{carBrandName(brand.id, lang)}</span><span className="car-brand-check" aria-hidden="true">{brand.id === value && <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="m5 12 4 4L19 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}</span></button></li>)}</ul>
      {brands.length === 0 && <p className="car-brand-empty" role="status">{ar ? 'لم يتم العثور على ماركة بهذا الاسم.' : 'No brands found.'}</p>}
    </div>
  </dialog>;
}
