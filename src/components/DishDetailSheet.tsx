"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import Image from "next/image";
import type { DietFilter, Dish } from "@/data/menu";
import type { Choice, Extra, PieceCount, Selection } from "@/data/types";
import { useCart } from "@/lib/cart";
import { useLocale } from "@/lib/locale";
import { dishDescription, fieldLabel, pickName, sectionName } from "@/lib/localize";
import { formatQar } from "@/lib/money";
import {
  imageFor,
  isSelectionComplete,
  preferredPieces,
  selectionForDiet,
  unitPrice,
} from "@/lib/price";
import { DietTags } from "./DietTags";

type Props = {
  dish: Dish | null;
  diet?: DietFilter;
  onClose: () => void;
};

export function DishDetailSheet({ dish, diet = "all", onClose }: Props) {
  const { add } = useCart();
  const { lang, t } = useLocale();
  const [sel, setSel] = useState<Selection>({});
  const [pickQty, setPickQty] = useState(1);
  const [justAdded, setJustAdded] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ start: 0, dy: 0, tracking: false, t: 0 });

  useEffect(() => {
    if (!dish) return;
    setSel(selectionForDiet(dish, diet));
    setPickQty(1);
    setJustAdded(false);
    setDragY(0);
    setDragging(false);
  }, [dish, diet]);

  useEffect(() => {
    if (!dish) return;
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dish, onClose]);

  if (!dish) return null;
  const current = dish;
  const unit = unitPrice(current, sel);
  const ready = isSelectionComplete(current, sel);
  const photo = imageFor(current, sel);
  const patterned = photo.startsWith("/brand/");

  function onAdd() {
    if (!ready) return;
    add(current.id, sel, pickQty);
    setJustAdded(true);
    window.setTimeout(() => onClose(), 700);
  }

  function onPointerDown(e: PointerEvent) {
    const sheet = sheetRef.current;
    if (!sheet) return;
    const target = e.target as HTMLElement;
    const onGrab = Boolean(target.closest(".sheet-grab, .detail-photo-wrap"));
    if (!onGrab && sheet.scrollTop > 2) return;
    drag.current = { start: e.clientY, dy: 0, tracking: true, t: performance.now() };
  }

  function onPointerMove(e: PointerEvent) {
    if (!drag.current.tracking) return;
    const dy = e.clientY - drag.current.start;
    if (!dragging && dy < 10) return;
    if (dy < 0) return;
    e.preventDefault();
    drag.current.dy = dy;
    setDragging(true);
    setDragY(dy);
  }

  function endDrag() {
    if (!drag.current.tracking) return;
    const { dy, t } = drag.current;
    const speed = dy / Math.max(1, performance.now() - t);
    drag.current.tracking = false;
    setDragging(false);
    if (dy > 88 || speed > 0.55) {
      onClose();
      return;
    }
    setDragY(0);
  }

  return (
    <div className="sheet-root">
      <button type="button" className="sheet-backdrop" aria-label={t.closeDetails} onClick={onClose} />
      <div
        ref={sheetRef}
        className={`detail-sheet${dragging ? " is-dragging" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-title"
        style={{ transform: dragY ? `translate3d(0, ${dragY}px, 0)` : undefined }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div className="detail-photo-wrap">
          <div className="sheet-grab" aria-hidden="true" />
          {patterned ? (
            <div
              className="detail-photo dish-photo-pattern"
              style={{ backgroundImage: `url(${photo})` }}
              aria-hidden="true"
            />
          ) : (
            <Image
              src={photo}
              alt={`${pickName(current, lang)}. ${dishDescription(current, lang)}`}
              fill
              sizes="(max-width: 430px) 100vw, 430px"
              unoptimized
              className="detail-photo"
            />
          )}
        </div>
        <header className="detail-kicker-row">
          <p className="ticket-kicker">{sectionName(current.section, lang)}</p>
          <button ref={closeRef} type="button" className="ticket-close" onClick={onClose}>
            {t.close}
          </button>
        </header>
        <div className="detail-title-row">
          <div>
            <h2 id="detail-title" className="ticket-title">
              {pickName(current, lang)}
            </h2>
            <p
              className={lang === "ar" ? "detail-en" : "detail-ar"}
              lang={lang === "ar" ? "en" : "ar"}
              dir={lang === "ar" ? "ltr" : "rtl"}
            >
              {lang === "ar" ? current.name : current.nameAr}
            </p>
          </div>
          <p className="detail-unit" aria-live="polite">
            {formatQar(unit)}
          </p>
        </div>
        <DietTags tags={current.tags} />
        <p className="detail-desc">{dishDescription(current, lang)}</p>

        <Configurator dish={current} sel={sel} setSel={setSel} />

        <div className="detail-foot">
          <div className="line-qty">
            <button
              type="button"
              className="qty-btn"
              aria-label={t.fewer}
              disabled={pickQty <= 1}
              onClick={() => setPickQty((n) => Math.max(1, n - 1))}
            >
              −
            </button>
            <span className="qty-num" aria-live="polite">
              {pickQty}
            </span>
            <button
              type="button"
              className="qty-btn"
              aria-label={t.more}
              onClick={() => setPickQty((n) => Math.min(20, n + 1))}
            >
              +
            </button>
          </div>
          <button
            type="button"
            className={`detail-add ${justAdded ? "detail-add-done" : ""}`}
            onClick={onAdd}
            disabled={!ready}
          >
            {justAdded ? t.added : `${t.addToOrder} · ${formatQar(unit * pickQty)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function Configurator({
  dish,
  sel,
  setSel,
}: {
  dish: Dish;
  sel: Selection;
  setSel: (s: Selection) => void;
}) {
  const { lang, t } = useLocale();
  const kind = dish.kind;
  const label = (name: string) => fieldLabel(name, lang);
  const named = <T extends { id: string; name: string; nameAr?: string; spicy?: boolean }>(
    items: T[],
  ) => items.map((item) => ({ ...item, name: pickName(item, lang) }));
  const extras = kind.type === "addons" ? kind.extras : dish.extras;

  return (
    <div className="config">
      {kind.type === "sauce-price" ? (
        <ChoiceRow
          label={label("Sauce")}
          options={kind.sauces.map((s) => ({
            id: s.id,
            name: pickName(s, lang),
            hint: `${s.priceQar} QAR`,
            spicy: s.spicy,
          }))}
          value={sel.sauce}
          onChange={(id) => setSel({ ...sel, sauce: id })}
        />
      ) : null}

      {kind.type === "spicy-toggle" ? (
        <ChoiceRow
          label={label("Heat")}
          options={[
            { id: "spicy", name: t.spicy, hint: `${kind.spicyQar} QAR`, spicy: true },
            { id: "mild", name: t.regular, hint: `${kind.mildQar} QAR` },
          ]}
          value={sel.spicy ? "spicy" : "mild"}
          onChange={(id) => setSel({ ...sel, spicy: id === "spicy" })}
        />
      ) : null}

      {kind.type === "roll" ? (
        <>
          {kind.proteins.length > 1 ? (
            <ChoiceRow
              label={label("Protein")}
              options={kind.proteins.map((p) => ({
                id: p.id,
                name: pickName(p, lang),
                hint: p.prices[sel.pieces ?? preferredPieces(p.prices)]
                  ? `${p.prices[sel.pieces ?? preferredPieces(p.prices)]} QAR`
                  : undefined,
                spicy: p.spicy,
              }))}
              value={sel.protein}
              onChange={(id) => {
                const protein = kind.proteins.find((p) => p.id === id);
                if (!protein) return;
                const pieces =
                  sel.pieces && protein.prices[sel.pieces] != null
                    ? sel.pieces
                    : preferredPieces(protein.prices);
                setSel({ ...sel, protein: id, pieces });
              }}
            />
          ) : null}
          <ChoiceRow
            label={label("Pieces")}
            options={pieceOptions(kind.proteins.find((p) => p.id === sel.protein) ?? kind.proteins[0]).map(
              (n) => {
                const protein = kind.proteins.find((p) => p.id === sel.protein) ?? kind.proteins[0];
                return {
                  id: String(n),
                  name: `${n}`,
                  hint: `${protein.prices[n]} QAR`,
                };
              },
            )}
            value={sel.pieces != null ? String(sel.pieces) : undefined}
            onChange={(id) => setSel({ ...sel, pieces: Number(id) as PieceCount })}
          />
          {kind.topping ? (
            <ChoiceRow
              label={label(kind.topping.name)}
              options={named(kind.topping.options)}
              value={sel.topping}
              onChange={(id) => setSel({ ...sel, topping: id })}
            />
          ) : null}
          {kind.style ? (
            <ChoiceRow
              label={label(kind.style.name)}
              options={named(kind.style.options)}
              value={sel.style}
              onChange={(id) => setSel({ ...sel, style: id })}
            />
          ) : null}
        </>
      ) : null}

      {kind.type === "deal-box" ? (
        <>
          <ChoiceRow
            label={label("Starter")}
            options={named(kind.starters)}
            value={sel.starter}
            onChange={(id) => setSel({ ...sel, starter: id })}
          />
          <ChoiceRow
            label={label("Sushi")}
            options={named(kind.sushi)}
            value={sel.sushi}
            onChange={(id) => setSel({ ...sel, sushi: id })}
          />
        </>
      ) : null}

      {kind.type === "party-box" ? (
        <PartyStarters
          options={kind.starters}
          selected={sel.starters ?? []}
          min={kind.starterMin}
          max={kind.starterMax}
          onChange={(starters) => setSel({ ...sel, starters })}
        />
      ) : null}

      {kind.type === "size-price" ? (
        <>
          {kind.flavors ? (
            <ChoiceRow
              label={label(kind.flavors.name)}
              options={named(kind.flavors.options)}
              value={sel.flavor}
              onChange={(id) => setSel({ ...sel, flavor: id })}
            />
          ) : null}
          <ChoiceRow
            label={label("Size")}
            options={kind.sizes.map((s) => ({
              id: s.id,
              name: pickName(s, lang),
              hint: `${s.priceQar} QAR`,
            }))}
            value={sel.size}
            onChange={(id) => setSel({ ...sel, size: id })}
          />
        </>
      ) : null}

      {kind.type === "addons" && kind.spicyOptional ? (
        <ChoiceRow
          label={label("Heat")}
          options={[
            { id: "spicy", name: t.spicy, spicy: true },
            { id: "mild", name: t.regular },
          ]}
          value={sel.spicy ? "spicy" : "mild"}
          onChange={(id) => setSel({ ...sel, spicy: id === "spicy" })}
        />
      ) : null}

      {kind.type === "addons"
        ? kind.freeChoices?.map((g) => (
            <ChoiceRow
              key={g.id}
              label={label(g.name)}
              options={named(g.options)}
              value={g.id === "cut" ? sel.cut : g.id === "style" ? sel.style : sel.topping}
              onChange={(id) => {
                if (g.id === "cut") setSel({ ...sel, cut: id });
                else if (g.id === "style") setSel({ ...sel, style: id });
                else setSel({ ...sel, topping: id });
              }}
            />
          ))
        : null}

      {dish.freeDips?.length ? (
        <ChoiceRow
          label={label("Dip")}
          options={named(dish.freeDips)}
          value={sel.dip}
          onChange={(id) => setSel({ ...sel, dip: id })}
        />
      ) : null}

      {extras?.length ? (
        <ExtraList
          extras={extras}
          selected={sel.extras ?? []}
          onToggle={(id) => {
            const cur = sel.extras ?? [];
            setSel({
              ...sel,
              extras: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
            });
          }}
        />
      ) : null}
    </div>
  );
}

function pieceOptions(protein: { prices: Partial<Record<PieceCount, number>> }): PieceCount[] {
  return ([4, 6, 8, 12, 24] as PieceCount[]).filter((n) => protein.prices[n] != null);
}

function ChoiceRow({
  label,
  labelAr,
  options,
  value,
  onChange,
}: {
  label: string;
  labelAr?: string;
  options: { id: string; name: string; hint?: string; spicy?: boolean }[];
  value?: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="choice-block">
      <div className="choice-head">
        <p className="choice-label">{label}</p>
        {labelAr ? (
          <p className="choice-label-ar" lang="ar" dir="rtl">
            {labelAr}
          </p>
        ) : null}
      </div>
      <div className="choice-row" role="radiogroup" aria-label={label}>
        {options.map((opt) => {
          const on = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              data-opt={opt.id}
              aria-checked={on}
              className={`opt ${on ? "opt-on" : ""} ${opt.spicy ? "opt-spicy" : ""}`}
              onClick={() => onChange(opt.id)}
            >
              <span>{opt.name}</span>
              {opt.hint ? <em>{opt.hint}</em> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PartyStarters({
  options,
  selected,
  min,
  max,
  onChange,
}: {
  options: Choice[];
  selected: string[];
  min: number;
  max: number;
  onChange: (ids: string[]) => void;
}) {
  const { lang, t } = useLocale();
  const show = (opt: Choice) => pickName(opt, lang);
  if (max <= 1) {
    return (
      <ChoiceRow
        label={fieldLabel("Starter", lang)}
        options={options.map((opt) => ({ id: opt.id, name: show(opt), spicy: opt.spicy }))}
        value={selected[0]}
        onChange={(id) => onChange([id])}
      />
    );
  }

  const counts = new Map<string, number>();
  for (const id of selected) counts.set(id, (counts.get(id) ?? 0) + 1);
  const total = selected.length;
  const range = min === max ? `${max}` : `${min} ${t.or} ${max}`;
  const summary =
    total > 1
      ? options
          .filter((opt) => counts.get(opt.id))
          .map((opt) => {
            const n = counts.get(opt.id) ?? 0;
            const name = show(opt);
            return n > 1 ? `${name} × ${n}` : name;
          })
          .join(lang === "ar" ? "، " : ", ")
      : "";

  function setCount(id: string, count: number) {
    const rest = selected.filter((item) => item !== id);
    const next = Math.max(0, Math.min(count, max - rest.length));
    onChange([...rest, ...Array.from({ length: next }, () => id)]);
  }

  return (
    <div className="starter-picks">
      <div className="choice-head">
        <p className="choice-label">{fieldLabel("Starters", lang)}</p>
      </div>
      <p className="choice-note">
        {t.pick} {range}. {t.starterAgain}
      </p>
      {summary ? (
        <p className="choice-same" aria-live="polite">
          {summary}
        </p>
      ) : null}
      <div className="choice-row">
        {options.map((opt) => {
          const count = counts.get(opt.id) ?? 0;
          if (count === 0) {
            return (
              <button
                key={opt.id}
                type="button"
                className={`opt ${opt.spicy ? "opt-spicy" : ""}`}
                disabled={total >= max}
                onClick={() => setCount(opt.id, 1)}
              >
                {show(opt)}
              </button>
            );
          }
          const name = show(opt);
          return (
            <div key={opt.id} className="opt opt-on starter-opt">
              <span>{name}</span>
              <span className="starter-step">
                <button
                  type="button"
                  aria-label={t.oneFewer(name)}
                  onClick={() => setCount(opt.id, count - 1)}
                >
                  −
                </button>
                <span aria-hidden="true">{count}</span>
                <button
                  type="button"
                  aria-label={t.oneMore(name)}
                  disabled={total >= max}
                  onClick={() => setCount(opt.id, count + 1)}
                >
                  +
                </button>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ExtraList({
  extras,
  selected,
  onToggle,
}: {
  extras: Extra[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const { lang } = useLocale();
  return (
    <div className="choice-block">
      <div className="choice-head">
        <p className="choice-label">{fieldLabel("Add-ons", lang)}</p>
      </div>
      <div className="extra-list">
        {extras.map((ex) => {
          const on = selected.includes(ex.id);
          return (
            <label key={ex.id} className={`extra ${on ? "extra-on" : ""}`}>
              <input type="checkbox" checked={on} onChange={() => onToggle(ex.id)} />
              <span>{pickName(ex, lang)}</span>
              <em>+{ex.priceQar} QAR</em>
            </label>
          );
        })}
      </div>
    </div>
  );
}
