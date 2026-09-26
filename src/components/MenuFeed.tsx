"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  CATEGORY_CHIPS,
  DIET_CHIPS,
  DISHES,
  matchesDiet,
  type DietFilter,
  type Dish,
  type Section,
} from "@/data/menu";
import { CartProvider, useCart } from "@/lib/cart";
import { LangButton, useLocale } from "@/lib/locale";
import { sectionName } from "@/lib/localize";
import { formatQar } from "@/lib/money";
import { CartSheet } from "./CartSheet";
import { DishDetailSheet } from "./DishDetailSheet";
import { DishSlide } from "./DishSlide";

function FeedInner() {
  const { itemCount, totalQar } = useCart();
  const { lang, t } = useLocale();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<Dish | null>(null);
  const [pop, setPop] = useState(false);
  const [diet, setDiet] = useState<DietFilter>("all");
  const [activeSection, setActiveSection] = useState<Section>("Starters");
  const [activeIndex, setActiveIndex] = useState(0);
  const prevCount = useRef(itemCount);
  const feedRef = useRef<HTMLDivElement>(null);
  const catRowRef = useRef<HTMLDivElement>(null);
  const skipSpy = useRef(false);

  const dishes = useMemo(() => DISHES.filter((d) => matchesDiet(d, diet)), [diet]);
  const looped = useMemo(() => {
    if (dishes.length === 0) return [];
    return [0, 1, 2].flatMap((copy) =>
      dishes.map((dish, real) => ({ dish, copy, real, key: `${copy}-${dish.id}` })),
    );
  }, [dishes]);
  const origin = dishes.length;
  const sheetOpen = open || Boolean(detail);
  const rowDrag = useRef(false);

  useEffect(() => {
    if (itemCount > prevCount.current) {
      setPop(true);
      const t = window.setTimeout(() => setPop(false), 420);
      prevCount.current = itemCount;
      return () => window.clearTimeout(t);
    }
    prevCount.current = itemCount;
  }, [itemCount]);

  const syncSectionFromScroll = useCallback(() => {
    const feed = feedRef.current;
    const n = dishes.length;
    if (!feed || skipSpy.current || !n) return;
    const h = feed.clientHeight;
    if (!h) return;
    const visual = Math.round(feed.scrollTop / h);
    const real = ((visual % n) + n) % n;
    const dish = dishes[real];
    if (!dish) return;
    setActiveIndex(real);
    setActiveSection(dish.section);
  }, [dishes]);

  const wrapLoop = useCallback(() => {
    const feed = feedRef.current;
    const n = dishes.length;
    if (!feed || skipSpy.current || !n) return;
    const h = feed.clientHeight;
    if (!h) return;
    const visual = Math.round(feed.scrollTop / h);
    if (visual < n) {
      skipSpy.current = true;
      feed.scrollTo({ top: (visual + n) * h });
      skipSpy.current = false;
    } else if (visual >= n * 2) {
      skipSpy.current = true;
      feed.scrollTo({ top: (visual - n) * h });
      skipSpy.current = false;
    }
    syncSectionFromScroll();
  }, [dishes.length, syncSectionFromScroll]);

  useEffect(() => {
    const feed = feedRef.current;
    if (!feed) return;
    const node = feed;
    let raf = 0;
    let wrapTimer = 0;
    function onScroll() {
      node.classList.add("is-scrolling");
      window.clearTimeout(wrapTimer);
      wrapTimer = window.setTimeout(() => {
        node.classList.remove("is-scrolling");
        wrapLoop();
      }, 140);
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        syncSectionFromScroll();
      });
    }
    node.addEventListener("scroll", onScroll, { passive: true });
    node.addEventListener("scrollend", wrapLoop);
    syncSectionFromScroll();
    return () => {
      node.classList.remove("is-scrolling");
      node.removeEventListener("scroll", onScroll);
      node.removeEventListener("scrollend", wrapLoop);
      if (raf) window.cancelAnimationFrame(raf);
      window.clearTimeout(wrapTimer);
    };
  }, [syncSectionFromScroll, wrapLoop]);

  useLayoutEffect(() => {
    const feed = feedRef.current;
    if (!feed || dishes.length === 0) return;
    skipSpy.current = true;
    const h = feed.clientHeight;
    feed.scrollTo({ top: origin * h });
    setActiveIndex(0);
    setActiveSection(dishes[0]?.section ?? "Starters");
    const t = window.setTimeout(() => {
      skipSpy.current = false;
    }, 80);
    return () => window.clearTimeout(t);
  }, [diet, dishes, origin]);

  useEffect(() => {
    const feed = feedRef.current;
    if (!feed) return;
    const top = feed.scrollTop;
    feed.style.overflowY = sheetOpen ? "hidden" : "";
    if (feed.scrollTop !== top) feed.scrollTop = top;
  }, [sheetOpen]);

  useEffect(() => {
    const row = catRowRef.current;
    if (!row) return;
    const chip = row.querySelector<HTMLElement>(`[data-chip="${cssAttr(activeSection)}"]`);
    if (!chip) return;
    const left = chip.offsetLeft - (row.clientWidth - chip.offsetWidth) / 2;
    row.scrollTo({ left: Math.max(0, left) });
  }, [activeSection]);

  function jumpTo(id: Section) {
    const feed = feedRef.current;
    if (!feed) return;
    skipSpy.current = true;
    const idx = dishes.findIndex((d) => d.section === id);
    if (idx < 0) {
      skipSpy.current = false;
      return;
    }
    setActiveIndex(idx);
    setActiveSection(id);
    const top = (origin + idx) * feed.clientHeight;
    const far = Math.abs(idx - activeIndex) > 3;
    feed.scrollTo({ top, behavior: far ? "auto" : "smooth" });
    let finished = false;
    function done() {
      if (finished) return;
      finished = true;
      skipSpy.current = false;
      syncSectionFromScroll();
    }
    feed.addEventListener("scrollend", done, { once: true });
    window.setTimeout(done, 1600);
  }

  return (
    <div className={`shell${sheetOpen ? " is-sheet" : ""}`}>
      <header className="chrome-header">
        <img src="/brand/logotype-white.svg" alt={t.brand} className="wordmark-img" />
        <div className="chrome-actions">
          <LangButton />
          <button
            type="button"
            className={`cart-btn ${pop ? "cart-btn-pop" : ""}`}
            onClick={() => setOpen(true)}
            aria-label={t.openOrder(itemCount)}
          >
            <TicketIcon />
            {itemCount > 0 ? <span className="cart-badge">{itemCount}</span> : null}
          </button>
        </div>
      </header>

      <div className="filter-bar" role="toolbar" aria-label={t.filters}>
        <div
          ref={catRowRef}
          className="chip-row"
          aria-label={t.category}
          onPointerDown={() => {
            rowDrag.current = false;
          }}
          onPointerMove={(e) => {
            if (Math.abs(e.movementX) > 2) rowDrag.current = true;
          }}
        >
          {CATEGORY_CHIPS.map((chip) => {
            const on = activeSection === chip.id;
            const empty = !dishes.some((d) => d.section === chip.id);
            return (
              <button
                key={chip.id}
                type="button"
                data-chip={chip.id}
                className={`chip ${on ? "chip-on" : ""}`}
                aria-pressed={on}
                aria-current={on ? "true" : undefined}
                disabled={empty}
                onClick={() => {
                  if (rowDrag.current) return;
                  jumpTo(chip.id);
                }}
              >
                {sectionName(chip.id, lang)}
              </button>
            );
          })}
        </div>
        <div
          className="chip-row chip-row-diet"
          aria-label={t.dietary}
          onPointerDown={() => {
            rowDrag.current = false;
          }}
          onPointerMove={(e) => {
            if (Math.abs(e.movementX) > 2) rowDrag.current = true;
          }}
        >
          {DIET_CHIPS.map((chip) => (
            <button
              key={chip.id}
              type="button"
              className={`chip chip-diet ${diet === chip.id ? "chip-on" : ""}`}
              aria-pressed={diet === chip.id}
              onClick={() => {
                if (rowDrag.current) return;
                setDiet(chip.id);
              }}
            >
              {t[chip.id]}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={feedRef}
        id="main"
        className="feed"
        role="feed"
        aria-label={t.menuFeed}
        inert={sheetOpen ? true : undefined}
      >
        {dishes.length === 0 ? (
          <div className="empty-filter">
            <p>{t.noMatch}</p>
            <button type="button" className="chip chip-on" onClick={() => setDiet("all")}>
              {t.clearFilters}
            </button>
          </div>
        ) : (
          looped.map((item) => {
            const n = dishes.length;
            const dist = Math.min(
              Math.abs(item.real - activeIndex),
              n - Math.abs(item.real - activeIndex),
            );
            const inView = item.copy === 1 && dist <= 2;
            const seam =
              (item.copy === 2 && item.real <= 1) || (item.copy === 0 && item.real >= n - 2);
            return (
              <DishSlide
                key={item.key}
                dish={item.dish}
                diet={diet}
                marked={item.copy === 1}
                active={item.copy === 1 && item.real === activeIndex}
                eager={inView || seam}
                showHint={item.copy === 1 && item.real === 0}
                onOpen={setDetail}
              />
            );
          })
        )}
      </div>

      {itemCount > 0 && !sheetOpen ? (
        <button type="button" className="sticky-cta" onClick={() => setOpen(true)}>
          {t.viewOrder} · {formatQar(totalQar, lang)}
        </button>
      ) : null}

      <div className="sr-only" aria-live="polite">
        {itemCount ? t.inOrder(itemCount) : ""}
        {activeSection ? ` ${sectionName(activeSection, lang)}` : ""}
      </div>

      <DishDetailSheet dish={detail} diet={diet} onClose={() => setDetail(null)} />
      <CartSheet open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function cssAttr(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
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
