"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { DietFilter, Dish } from "@/data/menu";
import type { Choice, Extra, PieceCount, Selection } from "@/data/types";
import { useCart } from "@/lib/cart";
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
  const [sel, setSel] = useState<Selection>({});
  const [pickQty, setPickQty] = useState(1);
  const [justAdded, setJustAdded] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!dish) return;
    setSel(selectionForDiet(dish, diet));
    setPickQty(1);
    setJustAdded(false);
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

  useEffect(() => {
    if (!justAdded) return;
    const t = window.setTimeout(() => setJustAdded(false), 900);
    return () => window.clearTimeout(t);
  }, [justAdded]);

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
    setPickQty(1);
  }

  return (
    <div className="sheet-root">
      <button type="button" className="sheet-backdrop" aria-label="Close details" onClick={onClose} />
      <div className="detail-sheet" role="dialog" aria-modal="true" aria-labelledby="detail-title">
        <div className="detail-photo-wrap">
          {patterned ? (
            <div
              className="detail-photo dish-photo-pattern"
              style={{ backgroundImage: `url(${photo})` }}
              aria-hidden="true"
            />
          ) : (
            <Image
              src={photo}
              alt={`${current.name}. ${current.description}`}
              fill
              sizes="(max-width: 430px) 100vw, 430px"
              unoptimized
              className="detail-photo"
            />
          )}
        </div>
        <header className="detail-kicker-row">
          <p className="ticket-kicker">{current.section}</p>
          <button ref={closeRef} type="button" className="ticket-close" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="detail-title-row">
          <div>
            <h2 id="detail-title" className="ticket-title">
              {current.name}
            </h2>
            <p className="detail-ar" lang="ar" dir="rtl">
              {current.nameAr}
            </p>
          </div>
          <p className="detail-unit" aria-live="polite">
            {formatQar(unit)}
          </p>
        </div>
        <DietTags tags={current.tags} />
        <p className="detail-desc">{current.description}</p>

        <Configurator dish={current} sel={sel} setSel={setSel} />

        <div className="detail-foot">
          <div className="line-qty">
            <button
              type="button"
              className="qty-btn"
              aria-label="Fewer"
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
              aria-label="More"
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
            {justAdded ? "Added" : `Add · ${formatQar(unit * pickQty)}`}
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
  const kind = dish.kind;
  const extras = kind.type === "addons" ? kind.extras : dish.extras;

  return (
    <div className="config">
      {kind.type === "sauce-price" ? (
        <ChoiceRow
          label="Sauce"
          labelAr="الصوص"
          options={kind.sauces.map((s) => ({
            id: s.id,
            name: s.name,
            hint: `${s.priceQar} QAR`,
            spicy: s.spicy,
          }))}
          value={sel.sauce}
          onChange={(id) => setSel({ ...sel, sauce: id })}
        />
      ) : null}

      {kind.type === "spicy-toggle" ? (
        <ChoiceRow
          label="Heat"
          labelAr="الحرارة"
          options={[
            { id: "mild", name: "Not spicy", hint: `${kind.mildQar} QAR` },
            { id: "spicy", name: "Spicy", hint: `${kind.spicyQar} QAR`, spicy: true },
          ]}
          value={sel.spicy ? "spicy" : "mild"}
          onChange={(id) => setSel({ ...sel, spicy: id === "spicy" })}
        />
      ) : null}

      {kind.type === "roll" ? (
        <>
          {kind.proteins.length > 1 ? (
            <ChoiceRow
              label="Protein"
              labelAr="البروتين"
              options={kind.proteins.map((p) => ({
                id: p.id,
                name: p.name,
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
            label="Pieces"
            labelAr="الحبات"
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
              label={kind.topping.name}
              options={kind.topping.options.map((o) => ({
                id: o.id,
                name: o.name,
                spicy: o.spicy,
              }))}
              value={sel.topping}
              onChange={(id) => setSel({ ...sel, topping: id })}
            />
          ) : null}
          {kind.style ? (
            <ChoiceRow
              label={kind.style.name}
              options={kind.style.options.map((o) => ({
                id: o.id,
                name: o.name,
                spicy: o.spicy,
              }))}
              value={sel.style}
              onChange={(id) => setSel({ ...sel, style: id })}
            />
          ) : null}
        </>
      ) : null}

      {kind.type === "deal-box" ? (
        <>
          <ChoiceRow
            label="Starter"
            labelAr="المقبلات"
            options={kind.starters.map((o) => ({ id: o.id, name: o.name, spicy: o.spicy }))}
            value={sel.starter}
            onChange={(id) => setSel({ ...sel, starter: id })}
          />
          <ChoiceRow
            label="Sushi"
            labelAr="السوشي"
            options={kind.sushi.map((o) => ({ id: o.id, name: o.name, spicy: o.spicy }))}
            value={sel.sushi}
            onChange={(id) => setSel({ ...sel, sushi: id })}
          />
        </>
      ) : null}

      {kind.type === "party-box" ? (
        <MultiRow
          label={kind.starterMax > 1 ? `Starters (${kind.starterMin}–${kind.starterMax})` : "Starter"}
          options={kind.starters}
          selected={sel.starters ?? []}
          max={kind.starterMax}
          onToggle={(id) => {
            const cur = sel.starters ?? [];
            if (cur.includes(id)) {
              setSel({ ...sel, starters: cur.filter((x) => x !== id) });
              return;
            }
            if (cur.length >= kind.starterMax) {
              setSel({ ...sel, starters: [...cur.slice(1), id] });
              return;
            }
            setSel({ ...sel, starters: [...cur, id] });
          }}
        />
      ) : null}

      {kind.type === "size-price" ? (
        <>
          {kind.flavors ? (
            <ChoiceRow
              label={kind.flavors.name}
              options={kind.flavors.options.map((o) => ({
                id: o.id,
                name: o.name,
                spicy: o.spicy,
              }))}
              value={sel.flavor}
              onChange={(id) => setSel({ ...sel, flavor: id })}
            />
          ) : null}
          <ChoiceRow
            label="Size"
            labelAr="الحجم"
            options={kind.sizes.map((s) => ({
              id: s.id,
              name: s.name,
              hint: `${s.priceQar} QAR`,
            }))}
            value={sel.size}
            onChange={(id) => setSel({ ...sel, size: id })}
          />
        </>
      ) : null}

      {kind.type === "addons" && kind.spicyOptional ? (
        <ChoiceRow
          label="Heat"
          labelAr="الحرارة"
          options={[
            { id: "mild", name: "Not spicy" },
            { id: "spicy", name: "Spicy", spicy: true },
          ]}
          value={sel.spicy ? "spicy" : "mild"}
          onChange={(id) => setSel({ ...sel, spicy: id === "spicy" })}
        />
      ) : null}

      {kind.type === "addons"
        ? kind.freeChoices?.map((g) => (
            <ChoiceRow
              key={g.id}
              label={g.name}
              options={g.options.map((o) => ({ id: o.id, name: o.name, spicy: o.spicy }))}
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
          label="Dip"
          labelAr="صوص"
          options={dish.freeDips.map((o) => ({ id: o.id, name: o.name, spicy: o.spicy }))}
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

function MultiRow({
  label,
  options,
  selected,
  max,
  onToggle,
}: {
  label: string;
  options: Choice[];
  selected: string[];
  max: number;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="choice-block">
      <div className="choice-head">
        <p className="choice-label">{label}</p>
        <p className="choice-count">
          {selected.length}/{max}
        </p>
      </div>
      <div className="choice-row">
        {options.map((opt) => {
          const on = selected.includes(opt.id);
          return (
            <button
              key={opt.id}
              type="button"
              data-opt={opt.id}
              className={`opt ${on ? "opt-on" : ""}`}
              aria-pressed={on}
              onClick={() => onToggle(opt.id)}
            >
              {opt.name}
            </button>
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
  return (
    <div className="choice-block">
      <div className="choice-head">
        <p className="choice-label">Add-ons</p>
        <p className="choice-label-ar" lang="ar" dir="rtl">
          إضافات
        </p>
      </div>
      <div className="extra-list">
        {extras.map((ex) => {
          const on = selected.includes(ex.id);
          return (
            <label key={ex.id} className={`extra ${on ? "extra-on" : ""}`}>
              <input type="checkbox" checked={on} onChange={() => onToggle(ex.id)} />
              <span>{ex.name}</span>
              <em>+{ex.priceQar} QAR</em>
            </label>
          );
        })}
      </div>
    </div>
  );
}
