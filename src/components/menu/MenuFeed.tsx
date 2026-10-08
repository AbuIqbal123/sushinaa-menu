"use client";

import Image from "next/image";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { matchesDiet, type DietFilter, type Dish, type Section } from "@/catalog/menu";
import { useMenu } from "@/cms/context";
import { CartProvider, useCart } from "@/ordering/cart";
import { LangButton, useLocale } from "@/i18n/locale";
import { pickName, sectionName as categoryName, type Lang } from "@/i18n/localize";
import { hasPriceRange, imageFor, photoPosition, unitPrice, selectionForDiet } from "@/ordering/price";
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
  const menu = useMenu();
  const { itemCount, totalQar } = useCart();
  const { lang, t } = useLocale();
  const sectionName = (id: Section, l: Lang) => categoryName(id, l, menu.categories);
  const dietChips = useMemo(
    () => menu.filters.filter((f) => f.visible).sort((a, b) => a.order - b.order),
    [menu.filters],
  );
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<Dish | null>(null);
  const [diet, setDiet] = useState<DietFilter>("all");
  const firstSection = menu.categories[0]?.id ?? "";
  const [category, setCategory] = useState<Section>(firstSection);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  // How far the open field reaches: from the search button to the logo's edge.
  const [searchWidth, setSearchWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const currentCategory = useRef<Section>(firstSection);
  const pendingJump = useRef<Section | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const search = normalizeSearch(query);
  const searchNames = useMemo(
    () => new Map(menu.dishes.map((dish) => [dish.id, normalizeSearch(`${pickName(dish, "en")} ${pickName(dish, "ar")}`)])),
    [menu.dishes],
  );
  const dietDishes = useMemo(() => menu.dishes.filter((dish) => matchesDiet(dish, diet)), [menu.dishes, diet]);
  const filledSections = useMemo(() => new Set(dietDishes.map((dish) => dish.section)), [dietDishes]);
  const dishes = useMemo(() => {
    if (!search) return dietDishes;
    const words = search.split(" ");
    return dietDishes.filter((dish) => words.every((word) => searchNames.get(dish.id)?.includes(word)));
  }, [dietDishes, search, searchNames]);
  // A language switch refreshes the menu data; only a different list should move the feed.
  const listKey = useMemo(() => dishes.map((dish) => dish.id).join("|"), [dishes]);
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
    // `dishes` is read through `listKey` so refreshed data with the same list keeps the position.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listKey, search]);

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

  const measureSearch = useCallback(() => {
    const button = searchButtonRef.current;
    const header = button?.closest("header");
    if (!button || !header) return;
    const b = button.getBoundingClientRect();
    const h = header.getBoundingClientRect();
    const pad = parseFloat(getComputedStyle(header).paddingInlineStart);
    setSearchWidth(lang === "ar" ? h.right - pad - b.left : b.right - h.left - pad);
  }, [lang]);

  function openSearch() {
    measureSearch();
    setSearchOpen(true);
  }

  // Focus in the same task as the tap, so phones raise the keyboard.
  useLayoutEffect(() => {
    if (searchOpen) searchInputRef.current?.focus({ preventScroll: true });
  }, [searchOpen]);

  // Follow rotation and split view; a phone keyboard only changes the height.
  useEffect(() => {
    if (!searchOpen) return;
    let width = window.innerWidth;
    const onResize = () => {
      if (window.innerWidth === width) return;
      width = window.innerWidth;
      measureSearch();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [searchOpen, measureSearch]);

  function closeSearch() {
    setQuery("");
    setSearchOpen(false);
    searchButtonRef.current?.focus();
  }

  function jumpTo(section: Section) {
    setSearchOpen(false);
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
      <header className={`chrome-header${searchOpen ? " search-open" : ""}`}>
        <img src={menu.settings.logo} alt={t.brand} className="wordmark-img" width={46} height={44} />
        <div className="chrome-actions">
          {/* One element: the button's pill opens into the field, toward the logo. */}
          <div className="header-search">
            <div id="menu-search-panel" className="header-search-field" role="search"
              style={{ width: searchWidth || undefined }} inert={!searchOpen}>
              <label htmlFor="menu-search" className="sr-only">{t.searchMenu}</label>
              <input ref={searchInputRef} id="menu-search" type="search" value={query} placeholder={t.searchMenu}
                onChange={(e) => setQuery(e.target.value)} autoComplete="off" maxLength={100} enterKeyHint="search"
                onKeyDown={(e) => { if (e.key === "Escape") closeSearch(); }} />
            </div>
            <button ref={searchButtonRef} type="button" className="cart-btn search-toggle"
              aria-label={searchOpen ? t.clearSearch : t.searchMenu} aria-expanded={searchOpen} aria-controls="menu-search-panel"
              onClick={() => searchOpen ? closeSearch() : openSearch()}>
              <svg className="search-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.6" />
                <path d="m16 16 4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              <svg className="close-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>
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
            <select value={category} onChange={(e) => jumpTo(e.target.value)}>
              {menu.categories.map((c) => <option key={c.id} value={c.id} disabled={!filledSections.has(c.id)}>{sectionName(c.id, lang)}</option>)}
            </select>
            <svg className="category-arrow" width="12" height="8" viewBox="0 0 12 8" fill="none" aria-hidden="true">
              <path d="m1 1 5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </label>
        </div>
        <div className="chip-row chip-row-diet" aria-label={t.dietary}>
          {dietChips.map((chip) => <button key={chip.id} type="button"
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
            {dishes.map((dish) => {
              const sel = selectionForDiet(dish, diet);
              const thumb = imageFor(dish, sel);
              return <button type="button" className="search-result" key={dish.id} onClick={() => setDetail(dish)}>
                <Image className="search-thumbnail" src={thumb} width={52} height={52} sizes="52px" alt="" unoptimized
                  style={{ objectPosition: photoPosition(dish, thumb) }} />
                <span className="search-result-name"><strong>{pickName(dish, lang)}</strong><small>{sectionName(dish.section, lang)}</small></span>
                <span>{`${hasPriceRange(dish) ? t.from + " " : ""}${formatQar(unitPrice(dish, sel), lang, menu.settings)}`}</span>
              </button>;
            })}
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
        {t.viewOrder} · {formatQar(totalQar, lang, menu.settings)}</button> : null}
      <div className="sr-only" aria-live="polite">{search ? t.searchResults(dishes.length) : ""}</div>
      {detail ? <DishDetailSheet key={`${detail.id}-${diet}`} dish={detail} diet={diet} onClose={() => setDetail(null)} /> : null}
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
