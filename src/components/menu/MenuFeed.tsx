"use client";

import Image from "next/image";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CATEGORY_CHIPS, DIET_CHIPS, DISHES, matchesDiet, type DietFilter, type Dish, type Section } from "@/catalog/menu";
import { CartProvider, useCart } from "@/ordering/cart";
import { LangButton, useLocale } from "@/i18n/locale";
import { pickName, sectionName } from "@/i18n/localize";
import { hasPriceRange, imageFor, unitPrice, selectionForDiet } from "@/ordering/price";
import { formatQar } from "@/lib/money";
import { CartSheet } from "../order/CartSheet";
import { DishDetailSheet } from "./DishDetailSheet";
import { DishSlide } from "./DishSlide";

// Ignore Arabic diacritics and common alef variants, plus case and punctuation.
function normalizeSearch(value: string) {
  return value.normalize("NFKD").toLowerCase().replace(/[\u0300-\u036f\u064b-\u065f\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function FeedInner() {
  const { itemCount, totalQar } = useCart();
  const { lang, t } = useLocale();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<Dish | null>(null);
  const [diet, setDiet] = useState<DietFilter>("all");
  const [category, setCategory] = useState<Section>("New");
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const currentCategory = useRef<Section>("New");
  const pendingJump = useRef<Section | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const search = normalizeSearch(query);
  const dishes = useMemo(() => DISHES.filter((dish) => {
    if (!matchesDiet(dish, diet)) return false;
    if (search) {
      const names = normalizeSearch(`${pickName(dish, "en")} ${pickName(dish, "ar")}`);
      return search.split(" ").every((word) => names.includes(word));
    }
    return true;
  }), [diet, search]);
  const sheetOpen = open || Boolean(detail);

  const looped = useMemo(() => [0, 1, 2].flatMap((copy) =>
    dishes.map((dish, real) => ({ dish, copy, real, key: `${copy}-${dish.id}` })),
  ), [dishes]);

  const syncCategory = useCallback(() => {
    const feed = feedRef.current;
    if (!feed || search || !dishes.length || !feed.clientHeight) return;
    const visual = Math.round(feed.scrollTop / feed.clientHeight);
    const real = ((visual % dishes.length) + dishes.length) % dishes.length;
    setActiveIndex(real);
    currentCategory.current = dishes[real].section;
    setCategory(dishes[real].section);
  }, [dishes, search]);

  const wrapLoop = useCallback(() => {
    const feed = feedRef.current;
    const n = dishes.length;
    if (!feed || search || !n || !feed.clientHeight) return;
    const visual = Math.round(feed.scrollTop / feed.clientHeight);
    if (visual < n) feed.scrollTo({ top: (visual + n) * feed.clientHeight, behavior: "instant" });
    else if (visual >= n * 2) feed.scrollTo({ top: (visual - n) * feed.clientHeight, behavior: "instant" });
    syncCategory();
  }, [dishes.length, search, syncCategory]);

  useLayoutEffect(() => {
    const feed = feedRef.current;
    if (!feed) return;
    if (search || !dishes.length) { feed.scrollTo({ top: 0 }); return; }
    const target = pendingJump.current ?? currentCategory.current;
    pendingJump.current = null;
    const index = Math.max(0, dishes.findIndex((dish) => dish.section === target));
    feed.scrollTo({ top: (dishes.length + index) * feed.clientHeight, behavior: "instant" });
  }, [dishes, search]);

  useEffect(() => {
    const feed = feedRef.current;
    if (!feed || search) return;
    let timer = 0;
    let raf = 0;
    function onScroll() {
      window.clearTimeout(timer);
      timer = window.setTimeout(wrapLoop, 140);
      if (!raf) raf = window.requestAnimationFrame(() => { raf = 0; syncCategory(); });
    }
    feed.addEventListener("scroll", onScroll, { passive: true });
    feed.addEventListener("scrollend", wrapLoop);
    syncCategory();
    return () => {
      feed.removeEventListener("scroll", onScroll);
      feed.removeEventListener("scrollend", wrapLoop);
      window.clearTimeout(timer);
      window.cancelAnimationFrame(raf);
    };
  }, [search, syncCategory, wrapLoop]);

  function jumpTo(section: Section) {
    currentCategory.current = section;
    setCategory(section);
    if (search) { pendingJump.current = section; setQuery(""); return; }
    const index = dishes.findIndex((dish) => dish.section === section);
    if (index < 0) return;
    setActiveIndex(index);
    feedRef.current?.scrollTo({ top: (dishes.length + index) * feedRef.current.clientHeight, behavior: "instant" });
  }

  function clearFilters() { setQuery(""); setDiet("all"); }

  return (
    <div className={`shell${sheetOpen ? " is-sheet" : ""}${itemCount > 0 ? " has-order" : ""}`}>
      <header className="chrome-header">
        <img src="/brand/logotype-white.svg" alt={t.brand} className="wordmark-img" />
        <div className="chrome-actions">
          <LangButton />
          <button type="button" className="cart-btn" onClick={() => setOpen(true)} aria-label={t.openOrder(itemCount)}>
            <TicketIcon />
            {itemCount > 0 ? <span className="cart-badge">{itemCount}</span> : null}
          </button>
        </div>
      </header>
      <div className="filter-bar" aria-label={t.filters} inert={sheetOpen ? true : undefined}>
        <div className="menu-tools">
          <label className="category-picker">
            <span className="sr-only">{t.category}</span>
            <select value={category} onChange={(e) => jumpTo(e.target.value as Section)}>
              {CATEGORY_CHIPS.map((chip) => <option key={chip.id} value={chip.id} disabled={!DISHES.some((dish) => dish.section === chip.id && matchesDiet(dish, diet))}>{sectionName(chip.id, lang)}</option>)}
            </select>
            <svg className="category-arrow" width="12" height="8" viewBox="0 0 12 8" fill="none" aria-hidden="true">
              <path d="m1 1 5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </label>
          <div className="menu-search" role="search">
            <label htmlFor="menu-search" className="sr-only">{t.searchMenu}</label>
            <input id="menu-search" type="search" value={query} placeholder={t.searchMenu}
              onChange={(e) => setQuery(e.target.value)} autoComplete="off" maxLength={100} />
            {query ? <button type="button" onClick={() => setQuery("")} aria-label={t.clearSearch}>×</button> : null}
          </div>
        </div>
        <div className="chip-row chip-row-diet" aria-label={t.dietary}>
          {DIET_CHIPS.map((chip) => <button key={chip.id} type="button"
            className={`chip chip-diet ${diet === chip.id ? "chip-on" : ""}`} aria-pressed={diet === chip.id}
            onClick={() => setDiet(chip.id)}>{t[chip.id]}</button>)}
        </div>
      </div>
      <div ref={feedRef} id="main" className={`feed${search ? " feed-search" : ""}`} role={search ? "region" : "feed"}
        aria-label={t.menuFeed} inert={sheetOpen ? true : undefined} style={{ overflowY: sheetOpen ? "hidden" : undefined }}>
        {dishes.length === 0 ? <div className="empty-filter"><p>{t.noMatch}</p>
          <button type="button" className="chip chip-on" onClick={clearFilters}>{t.clearFilters}</button></div>
          : search ? <div className="search-results">
            <p className="search-summary">{t.searchResults(dishes.length)}</p>
            {dishes.map((dish) => <button type="button" className="search-result" key={dish.id} onClick={() => setDetail(dish)}>
              <Image className="search-thumbnail" src={imageFor(dish, selectionForDiet(dish, diet))}
                width={52} height={52} sizes="52px" alt="" unoptimized />
              <span className="search-result-name"><strong>{pickName(dish, lang)}</strong><small>{sectionName(dish.section, lang)}</small></span>
              <span>{`${hasPriceRange(dish) ? t.from + " " : ""}${formatQar(unitPrice(dish, selectionForDiet(dish, diet)), lang)}`}</span>
            </button>)}
          </div> : looped.map((item) => {
            const n = dishes.length;
            const distance = Math.min(Math.abs(item.real - activeIndex), n - Math.abs(item.real - activeIndex));
            const seam = (item.copy === 0 && item.real >= n - 2) || (item.copy === 2 && item.real <= 1);
            return <DishSlide key={item.key} dish={item.dish} diet={diet} marked={item.copy === 1}
              active={item.copy === 1 && item.real === activeIndex}
              eager={(item.copy === 1 && distance <= 2) || seam}
              showHint={item.copy === 1 && item.real === 0 && n > 1} onOpen={setDetail} />;
          })}
      </div>
      {itemCount > 0 && !sheetOpen ? <button type="button" className="sticky-cta" onClick={() => setOpen(true)}>
        {t.viewOrder} · {formatQar(totalQar, lang)}</button> : null}
      <div className="sr-only" aria-live="polite">{search ? t.searchResults(dishes.length) : ""}</div>
      <DishDetailSheet dish={detail} diet={diet} onClose={() => setDetail(null)} />
      <CartSheet open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function TicketIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 4.5h10a1.5 1.5 0 0 1 1.5 1.5v2.2a1.7 1.7 0 0 0 0 3.4V18a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 18v-6.4a1.7 1.7 0 0 0 0-3.4V6A1.5 1.5 0 0 1 7 4.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M9 9.2h6M9 12.4h6M9 15.6h3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function MenuFeed() {
  return (
    <CartProvider>
      <FeedInner />
    </CartProvider>
  );
}
