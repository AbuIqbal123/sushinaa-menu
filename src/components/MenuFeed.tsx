"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CATEGORY_CHIPS,
  DIET_CHIPS,
  DISHES,
  matchesDiet,
  type CategoryFilter,
  type DietFilter,
  type Dish,
  type Section,
} from "@/data/menu";
import { CartProvider, useCart } from "@/lib/cart";
import { CartSheet } from "./CartSheet";
import { DishDetailSheet } from "./DishDetailSheet";
import { DishSlide } from "./DishSlide";

function FeedInner() {
  const { itemCount } = useCart();
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
  const sheetOpen = open || Boolean(detail);

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
    if (!feed || skipSpy.current) return;
    const h = feed.clientHeight;
    if (!h) return;
    const index = Math.max(0, Math.min(dishes.length - 1, Math.round(feed.scrollTop / h)));
    const dish = dishes[index];
    if (!dish) return;
    setActiveIndex(index);
    setActiveSection(dish.section);
  }, [dishes]);

  useEffect(() => {
    const feed = feedRef.current;
    if (!feed) return;
    let raf = 0;
    function onScroll() {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        syncSectionFromScroll();
      });
    }
    feed.addEventListener("scroll", onScroll, { passive: true });
    syncSectionFromScroll();
    return () => {
      feed.removeEventListener("scroll", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [syncSectionFromScroll]);

  useEffect(() => {
    const feed = feedRef.current;
    if (!feed) return;
    skipSpy.current = true;
    feed.scrollTo({ top: 0 });
    setActiveIndex(0);
    setActiveSection(dishes[0]?.section ?? "Starters");
    const t = window.setTimeout(() => {
      skipSpy.current = false;
    }, 80);
    return () => window.clearTimeout(t);
  }, [diet, dishes]);

  useEffect(() => {
    const feed = feedRef.current;
    if (!feed) return;
    feed.style.overflowY = sheetOpen ? "hidden" : "";
  }, [sheetOpen]);

  useEffect(() => {
    const row = catRowRef.current;
    if (!row) return;
    const chip = row.querySelector<HTMLElement>(`[data-chip="${cssAttr(activeSection)}"]`);
    if (!chip) return;
    const left = chip.offsetLeft - (row.clientWidth - chip.offsetWidth) / 2;
    row.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [activeSection]);

  function jumpTo(id: CategoryFilter) {
    const feed = feedRef.current;
    if (!feed) return;
    skipSpy.current = true;
    if (id === "all") {
      setActiveIndex(0);
      setActiveSection(dishes[0]?.section ?? "Starters");
      feed.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      const idx = dishes.findIndex((d) => d.section === id);
      if (idx < 0) {
        skipSpy.current = false;
        return;
      }
      setActiveIndex(idx);
      setActiveSection(id);
      const top = idx * feed.clientHeight;
      const far = Math.abs(idx - activeIndex) > 3;
      feed.scrollTo({ top, behavior: far ? "auto" : "smooth" });
    }
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
        <img src="/brand/logotype-white.svg" alt="Sushinaa" className="wordmark-img" />
        <button
          type="button"
          className={`cart-btn ${pop ? "cart-btn-pop" : ""}`}
          onClick={() => setOpen(true)}
          aria-label={itemCount ? `Open ticket, ${itemCount} items` : "Open ticket"}
        >
          <TicketIcon />
          {itemCount > 0 ? <span className="cart-badge">{itemCount}</span> : null}
        </button>
      </header>

      <div className="filter-bar" role="toolbar" aria-label="Menu filters">
        <div ref={catRowRef} className="chip-row" aria-label="Category">
          {CATEGORY_CHIPS.map((chip) => {
            const on = chip.id !== "all" && activeSection === chip.id;
            const empty = chip.id !== "all" && !dishes.some((d) => d.section === chip.id);
            return (
              <button
                key={chip.id}
                type="button"
                data-chip={chip.id}
                className={`chip ${on ? "chip-on" : ""}`}
                aria-pressed={on}
                aria-current={on ? "true" : undefined}
                disabled={empty}
                onClick={() => jumpTo(chip.id)}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
        <div className="chip-row chip-row-diet" aria-label="Dietary">
          {DIET_CHIPS.map((chip) => (
            <button
              key={chip.id}
              type="button"
              className={`chip chip-diet ${diet === chip.id ? "chip-on" : ""}`}
              aria-pressed={diet === chip.id}
              onClick={() => setDiet(chip.id)}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={feedRef}
        className="feed"
        role="feed"
        aria-label="Sushinaa menu"
        inert={sheetOpen ? true : undefined}
      >
        {dishes.length === 0 ? (
          <div className="empty-filter">
            <p>No dishes match these filters.</p>
            <button type="button" className="chip chip-on" onClick={() => setDiet("all")}>
              Clear filters
            </button>
          </div>
        ) : (
          dishes.map((dish, index) => (
            <DishSlide
              key={dish.id}
              dish={dish}
              index={index}
              diet={diet}
              active={index === activeIndex}
              eager={Math.abs(index - activeIndex) <= 2}
              onOpen={setDetail}
            />
          ))
        )}
      </div>

      <div className="sr-only" aria-live="polite">
        {itemCount ? `${itemCount} ${itemCount === 1 ? "item" : "items"} on the ticket` : ""}
        {activeSection ? ` ${activeSection}` : ""}
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
