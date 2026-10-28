"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type CSSProperties } from "react";
import { matchesDiet, type DietFilter, type Dish, type Section } from "@/catalog/menu";
import { useMenu } from "@/cms/context";
import { CartProvider, useCart } from "@/ordering/cart";
import { LangButton, useLocale, useSetSheetOpen } from "@/i18n/locale";
import { pickName, sectionName as categoryName, type Lang } from "@/i18n/localize";
import { hasPriceRange, imageFor, photoPosition, unitPrice, selectionForDiet } from "@/ordering/price";
import { formatQar } from "@/lib/money";
import { CartSheet } from "../order/CartSheet";
import { CategoryOverlay } from "./CategoryOverlay";
import { DishDetailSheet } from "./DishDetailSheet";
import { DishSlide } from "./DishSlide";

// Ignore Arabic diacritics and common alef variants, plus case and punctuation.
function normalizeSearch(value: string) {
  return value.normalize("NFKD").toLowerCase().replace(/[\u0300-\u036f\u064b-\u065f\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

type OrderingFeedProps = { branch?: string; onPickup?: () => void; branchBar?: ReactNode };

function FeedInner({ branch, onPickup, branchBar }: OrderingFeedProps) {
  const menu = useMenu();
  const { itemCount, totalQar } = useCart();
  const { lang, t } = useLocale();
  const sectionName = (id: Section, l: Lang) => categoryName(id, l, menu.categories);
  const dietChips = useMemo(
    () => menu.filters.filter((f) => f.visible).sort((a, b) => a.order - b.order),
    [menu.filters],
  );
  const [open, setOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const categoryButtonRef = useRef<HTMLButtonElement>(null);
  const [detail, setDetail] = useState<Dish | null>(null);
  const [diet, setDiet] = useState<DietFilter>("all");
  const firstSection = menu.categories[0]?.id ?? "";
  const [category, setCategory] = useState<Section>(firstSection);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [showCategoryHint, setShowCategoryHint] = useState(true);
  const [pickedCategory, setPickedCategory] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setShowCategoryHint(false), 6500);
    return () => window.clearTimeout(timer);
  }, []);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  // How far the open field reaches: from the search button to the logo's edge.
  const [searchWidth, setSearchWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  // Scroll index across the three copies. The loop jump happens after the swipe,
  // so this stays on the copy actually on screen.
  const [visualIndex, setVisualIndex] = useState<number | null>(null);
  const currentCategory = useRef<Section>(firstSection);
  const pendingJump = useRef<Section | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<HTMLDivElement>(null);
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
  const sheetOpen = open || Boolean(detail) || categoriesOpen;
  const setSheetInert = useSetSheetOpen();
  useEffect(() => {
    setSheetInert(sheetOpen);
    return () => setSheetInert(false);
  }, [sheetOpen, setSheetInert]);

  const looped = useMemo(() => [0, 1, 2].flatMap((copy) =>
    dishes.map((dish, real) => ({ dish, copy, real, key: `${copy}-${dish.id}` })),
  ), [dishes]);

  // Decode the slide on screen and the ones a swipe will reach. The feed used
  // to leave those photos lazy, so each swipe started the download.
  const warmed = useRef(new Set<string>());
  useEffect(() => {
    if (search || !dishes.length) return;
    const n = dishes.length;
    for (let delta = -1; delta <= 3; delta++) {
      const dish = dishes[(activeIndex + delta + n) % n];
      const photo = imageFor(dish, selectionForDiet(dish, diet));
      if (photo.startsWith("/brand/") || warmed.current.has(photo)) continue;
      warmed.current.add(photo);
      const img = document.createElement("img");
      img.decoding = "async";
      img.src = photo;
      img.decode().catch(() => {});
    }
  }, [activeIndex, dishes, diet, search]);

  // A category jump scrolls on a later turn. Ignore the position until the latest one lands.
  const snapHold = useRef(0);
  const demonstrating = useRef(false);
  const demoSeen = useRef(false);
  const syncCategory = useCallback(() => {
    const feed = feedRef.current;
    if (!feed || search || !dishes.length || !feed.clientHeight || snapHold.current > 0 || demonstrating.current) return;
    const visual = Math.round(feed.scrollTop / feed.clientHeight);
    const real = ((visual % dishes.length) + dishes.length) % dishes.length;
    setVisualIndex(visual);
    if (real !== 0) setShowCategoryHint(false);
    setActiveIndex(real);
    currentCategory.current = dishes[real].section;
    setCategory(dishes[real].section);
  }, [dishes, search]);

  const wrapLoop = useCallback(() => {
    const feed = feedRef.current;
    const n = dishes.length;
    if (!feed || search || !n || !feed.clientHeight || demonstrating.current) return;
    const visual = Math.round(feed.scrollTop / feed.clientHeight);
    if (visual < n) feed.scrollTo({ top: (visual + n) * feed.clientHeight, behavior: "instant" });
    else if (visual >= n * 2) feed.scrollTo({ top: (visual - n) * feed.clientHeight, behavior: "instant" });
    syncCategory();
  }, [dishes.length, search, syncCategory]);

  // A phone ignores a scroll made while the tap is still down, then snap
  // stays on the dish already on screen. Move after the tap ends, with snap
  // off for that one assignment. Drop the inline override afterwards. Restoring
  // a saved value sticks on "none" when a second tap runs before the first frame.
  function scrollAfterTap(top: number) {
    const token = ++snapHold.current;
    window.setTimeout(() => {
      const node = feedRef.current;
      const latest = snapHold.current === token;
      if (latest) snapHold.current = 0;
      if (!node || !latest) return;
      node.style.scrollSnapType = "none";
      node.scrollTop = top;
      syncCategory();
      window.requestAnimationFrame(() => {
        node.style.removeProperty("scroll-snap-type");
      });
    }, 0);
  }

  useLayoutEffect(() => {
    const feed = feedRef.current;
    if (!feed) return;
    if (search || !dishes.length) { feed.scrollTo({ top: 0 }); return; }
    const target = pendingJump.current ?? currentCategory.current;
    const fromCategoryTap = pendingJump.current !== null;
    pendingJump.current = null;
    const index = Math.max(0, dishes.findIndex((dish) => dish.section === target));
    const visual = dishes.length + index;
    const top = visual * feed.clientHeight;
    // Closing search from a category tap still has the finger down, so it needs
    // the same deferred snap bypass as a direct jump.
    if (fromCategoryTap) {
      setActiveIndex(index);
      setVisualIndex(visual);
      scrollAfterTap(top);
      return;
    }
    feed.scrollTo({ top, behavior: "instant" });
    // Read the new position now, so the photos around it render with this commit.
    syncCategory();
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

  // A short peek reveals the next photo without skipping the first dish. Any
  // customer input cancels it immediately; never pull someone back mid-swipe.
  useEffect(() => {
    const feed = feedRef.current;
    if (!feed || demoSeen.current || searchOpen || sheetOpen || diet !== "all" || dishes.length < 2) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motion.matches) { demoSeen.current = true; return; }
    let frame = 0;
    let origin: number | null = null;
    let stopped = false;
    const stop = () => {
      stopped = true;
      window.clearTimeout(timer);
      window.cancelAnimationFrame(frame);
      demonstrating.current = false;
      if (gestureRef.current) gestureRef.current.hidden = true;
      feed.style.removeProperty("scroll-snap-type");
    };
    const timer = window.setTimeout(() => {
      if (stopped) return;
      demoSeen.current = true;
      origin = feed.scrollTop;
      demonstrating.current = true;
      feed.style.scrollSnapType = "none";
      if (gestureRef.current) gestureRef.current.hidden = false;
      const start = performance.now();
      const animate = (now: number) => {
        const progress = Math.min(1, (now - start) / 1900);
        // Two quick gestures, with a smaller second bounce. The hand and menu
        // share one animation clock so the demonstration feels like a swipe.
        const cycle = progress < .45 ? progress / .45 : progress < .55 ? 0 : (progress - .55) / .45;
        const amplitude = progress < .45 ? .3 : .2;
        const offset = feed.clientHeight * amplitude * Math.sin(Math.PI * cycle) ** 2;
        feed.scrollTop = origin! + offset;
        const gesture = gestureRef.current;
        if (gesture) {
          gesture.style.transform = `translate(-50%, -50%) translateY(${-offset * .45}px)`;
          gesture.style.opacity = String(Math.min(1, progress * 12, (1 - progress) * 12));
        }
        if (progress < 1) frame = window.requestAnimationFrame(animate);
        else {
          demonstrating.current = false;
          if (gestureRef.current) gestureRef.current.hidden = true;
          feed.style.removeProperty("scroll-snap-type");
          syncCategory();
        }
      };
      frame = window.requestAnimationFrame(animate);
    }, 1100);
    const interrupt = () => { demoSeen.current = true; stop(); };
    const events = ["pointerdown", "touchstart", "wheel", "keydown"] as const;
    events.forEach((event) => window.addEventListener(event, interrupt, { passive: true, capture: true }));
    motion.addEventListener("change", interrupt);
    return () => {
      // A rerender/modal must not leave the menu partway through the demo.
      if (demonstrating.current && origin !== null) feed.scrollTop = origin;
      stop();
      events.forEach((event) => window.removeEventListener(event, interrupt, true));
      motion.removeEventListener("change", interrupt);
    };
  }, [diet, dishes.length, searchOpen, sheetOpen, syncCategory]);

  const measureSearch = useCallback(() => {
    const button = searchButtonRef.current;
    const header = button?.closest("header");
    if (!button || !header) return;
    const b = button.getBoundingClientRect();
    const h = header.getBoundingClientRect();
    const pad = parseFloat(getComputedStyle(header).paddingInlineStart);
    setSearchWidth(lang === "ar" ? h.right - pad - b.left : b.right - h.left - pad);
  }, [lang]);

  // Width is known before the first tap, so opening only starts the animation.
  useLayoutEffect(() => {
    measureSearch();
  }, [measureSearch]);

  function openSearch() {
    setShowCategoryHint(false);
    setSearchOpen(true);
  }

  // Focus in the same task as the tap, so phones raise the keyboard.
  useLayoutEffect(() => {
    if (searchOpen) searchInputRef.current?.focus({ preventScroll: true });
  }, [searchOpen]);

  // Follow rotation and split view; a phone keyboard only changes the height.
  useEffect(() => {
    let width = window.innerWidth;
    const onResize = () => {
      if (window.innerWidth === width) return;
      width = window.innerWidth;
      measureSearch();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [measureSearch]);

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
    const feed = feedRef.current;
    const index = dishes.findIndex((dish) => dish.section === section);
    if (!feed || index < 0) return;
    const top = (dishes.length + index) * feed.clientHeight;
    setActiveIndex(index);
    scrollAfterTap(top);
  }

  function closeCategories() {
    setCategoriesOpen(false);
    window.requestAnimationFrame(() => categoryButtonRef.current?.focus());
  }

  function clearFilters() { setQuery(""); setDiet("all"); }

  return (
    <div className={`shell${sheetOpen ? " is-sheet" : ""}${itemCount > 0 ? " has-order" : ""}`}>
      <header className={`chrome-header${searchOpen ? " search-open" : ""}`} inert={sheetOpen}>
        <Link href="/?pick=1" className="branch-switch" prefetch={false}>
          <span className="branch-switch-name">{branch}</span><span aria-hidden="true">▾</span>
        </Link>
        <div className="brand-navigation">
          {/* Brand and branch both lead back to the branch picker. */}
          <Link href="/?pick=1" className="brand-mark" aria-label={`${t.brand}, ${branch}, change branch`} prefetch={false}>
            <img src={menu.settings.logo} alt="" className="wordmark-img" width={46} height={44} />
          </Link>
          <div className="category-navigation">
            <button ref={categoryButtonRef} type="button" className="cart-btn category-toggle"
              aria-label={`${t.category}: ${sectionName(category, lang)}`} title={sectionName(category, lang)}
              aria-haspopup="dialog" aria-expanded={categoriesOpen} aria-controls="category-overlay"
              onClick={() => { setShowCategoryHint(false); setSearchOpen(false); setCategoriesOpen(true); }}>
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              <span className="current-category">{sectionName(category, lang) || t.category}</span>
            </button>
            {showCategoryHint && !sheetOpen && !searchOpen && activeIndex === 0 ? (
              <span className="category-discovery" aria-hidden="true">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path d="M20 12H4m6-6-6 6 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>{t.categoryHint}</span>
              </span>
            ) : null}
          </div>
        </div>
        <div className="chrome-actions">
          {/* One element: the button's pill opens into the field, toward the logo. */}
          <div className="header-search">
            <div id="menu-search-panel" className="header-search-field" role="search"
              style={{ width: searchWidth || undefined }} inert={!searchOpen}>
              <label htmlFor="menu-search" className="sr-only">{t.searchMenu}</label>
              <input ref={searchInputRef} id="menu-search" type="text" inputMode="search" value={query}
                placeholder={t.searchMenu}
                onChange={(e) => setQuery(e.target.value)} autoComplete="off" autoCorrect="off" autoCapitalize="off"
                spellCheck={false} maxLength={100} enterKeyHint="search"
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
      {branchBar ? <div className="order-branch-bar" inert={sheetOpen}>{branchBar}</div> : null}
      <div ref={feedRef} id="main" className={`feed${search ? " feed-search" : ""}`} role={search ? "region" : "feed"}
        aria-label={t.menuFeed} inert={sheetOpen ? true : undefined} style={{ overflowY: sheetOpen ? "hidden" : undefined }}>
        {dishes.length === 0 ? <div className="empty-filter"><p>{t.noMatch}</p>
          <button type="button" className="chip chip-on" onClick={clearFilters}>{t.clearFilters}</button></div>
          : search ? <div className="search-results">
            <p className="search-summary">{t.searchResults(dishes.length)}</p>
            {dishes.map((dish, i) => {
              const sel = selectionForDiet(dish, diet);
              const thumb = imageFor(dish, sel);
              return <button type="button" className="search-result stagger" key={dish.id} onClick={() => setDetail(dish)}
                style={{ "--i": Math.min(i, 6) } as CSSProperties}>
                <Image className="search-thumbnail" src={thumb} width={52} height={52} sizes="52px" alt="" unoptimized
                  style={{ objectPosition: photoPosition(dish, thumb) }} />
                <span className="search-result-name"><strong>{pickName(dish, lang)}</strong><small>{sectionName(dish.section, lang)}</small></span>
                <span>{`${hasPriceRange(dish) ? t.from + " " : ""}${formatQar(unitPrice(dish, sel), lang, menu.settings)}`}</span>
              </button>;
            })}
          </div> : looped.map((item) => {
            const n = dishes.length;
            // Keep the slide on screen, the next few, and the copy the loop jumps to.
            // Wrapping used to drop the photo and show the empty slide for a moment.
            const parked = visualIndex ?? n + activeIndex;
            const delta = item.copy * n + item.real - parked;
            const spot = ((parked % n) + n) % n;
            const atSeam = spot <= 3 || spot >= n - 2;
            const close = (d: number) => d >= -1 && d <= 3;
            return <DishSlide key={item.key} dish={item.dish} diet={diet} marked={item.copy === 1}
              active={item.copy === 1 && item.real === activeIndex}
              eager={close(delta) || (atSeam && (close(delta - n) || close(delta + n)))}
              inert={item.copy !== 1}
              onOpen={setDetail} />;
          })}
      </div>
      <div ref={gestureRef} className="scroll-gesture" hidden aria-hidden="true">
        <svg className="scroll-gesture-trail" width="26" height="35" viewBox="0 0 26 35" fill="none">
          <path d="m5 12 8-8 8 8M13 5v25" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <svg className="scroll-gesture-hand" width="64" height="80" viewBox="0 0 26 32" fill="currentColor">
          <path d="M8 16V4a2 2 0 0 1 4 0v8a2 2 0 0 1 4 0v1a2 2 0 0 1 4 0v2a2 2 0 0 1 4 0v7c0 5-3 8-8 8h-2c-3 0-5-2-7-5l-5-7c-1.5-2.5 1-4.5 3-2l3 3Z" stroke="#3a241d" strokeWidth="1" strokeLinejoin="round" />
          <path d="M12 12v6m4-5v6m4-4v5" stroke="#9d7663" strokeWidth=".8" strokeLinecap="round" />
        </svg>
      </div>
      {itemCount > 0 && !sheetOpen ? <button type="button" className="sticky-cta" onClick={() => setOpen(true)}>
        {t.viewOrder} · {formatQar(totalQar, lang, menu.settings)}</button> : null}
      <CategoryOverlay open={categoriesOpen} title={t.menu} label={t.category} closeLabel={t.close}
        logo={menu.settings.logo} brand={t.brand} value={category}
        filters={<div className="category-filters" role="group" aria-label={t.filters}>
          <p>{t.dietary}</p>
          <div className="chip-row chip-row-diet" aria-label={t.dietary}>
            {dietChips.map((chip) => <button key={chip.id} type="button"
              className={`chip chip-diet ${diet === chip.id ? "chip-on" : ""}`} aria-pressed={diet === chip.id}
              onClick={() => setDiet(chip.id)}>{t[chip.id]}</button>)}
          </div>
        </div>}
        options={menu.categories.map((c) => ({ id: c.id, label: sectionName(c.id, lang), disabled: !filledSections.has(c.id) }))}
        onClose={closeCategories} onChange={(section) => { jumpTo(section); setPickedCategory(sectionName(section, lang)); closeCategories(); }} />
      <div className="sr-only" aria-live="polite">{pickedCategory}</div>
      <div className="sr-only" aria-live="polite">{search ? t.searchResults(dishes.length) : ""}</div>
      {detail ? <DishDetailSheet key={`${detail.id}-${diet}`} dish={detail} diet={diet} ordering={Boolean(onPickup)} onClose={() => setDetail(null)} /> : null}
      <CartSheet open={open} onClose={() => setOpen(false)} onPickup={onPickup} />
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

export function MenuFeed(props: OrderingFeedProps) {
  if (props.onPickup) return <FeedInner {...props} />;
  return (
    <CartProvider>
      <FeedInner {...props} />
    </CartProvider>
  );
}
