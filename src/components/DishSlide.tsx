"use client";

import Image from "next/image";
import type { DietFilter, Dish } from "@/data/menu";
import { formatQar } from "@/lib/money";
import { hasPriceRange, imageFor, selectionForDiet, unitPrice } from "@/lib/price";
import { DietTags } from "./DietTags";

type Props = {
  dish: Dish;
  index: number;
  diet?: DietFilter;
  active?: boolean;
  eager?: boolean;
  onOpen: (dish: Dish) => void;
};

export function DishSlide({
  dish,
  index,
  diet = "all",
  active = false,
  eager = false,
  onOpen,
}: Props) {
  const sel = selectionForDiet(dish, diet);
  const from = hasPriceRange(dish);
  const price = unitPrice(dish, sel);
  const photo = imageFor(dish, sel);
  const patterned = photo.startsWith("/brand/");
  const showPhoto = eager || patterned;

  return (
    <article
      className={`slide${active ? " is-active" : ""}`}
      id={`dish-${dish.id}`}
      data-section={dish.section}
      aria-label={`${dish.name}, ${from ? "from " : ""}${formatQar(price)}. Tap for details.`}
    >
      <button
        type="button"
        className="slide-hit"
        onClick={() => onOpen(dish)}
        aria-label={`Open ${dish.name} details`}
      >
        {patterned ? (
          <div
            className="dish-photo dish-photo-pattern"
            style={{ backgroundImage: `url(${photo})` }}
            aria-hidden="true"
          />
        ) : showPhoto ? (
          <Image
            src={photo}
            alt={dish.name}
            fill
            sizes="(max-width: 430px) 100vw, 430px"
            priority={active || index < 2}
            unoptimized
            draggable={false}
            className="dish-photo"
            fetchPriority={active ? "high" : "low"}
          />
        ) : (
          <div className="dish-photo-ph" aria-hidden="true" />
        )}
        <div className="scrim" />

        {index === 0 ? (
          <p className="swipe-hint" aria-hidden="true">
            Swipe up
            <span className="swipe-chevron">⌃</span>
          </p>
        ) : null}

        <div className="slide-copy">
          <p className="section-label">{dish.section}</p>
          <div className="title-row">
            <h2 className="dish-name">{dish.name}</h2>
            <p className="dish-price">
              {from ? <span className="from">from </span> : null}
              {formatQar(price)}
            </p>
          </div>
          <p className="dish-ar" lang="ar" dir="rtl">
            {dish.nameAr}
          </p>
          <DietTags tags={dish.tags} />
          <p className="dish-desc dish-desc-feed">{dish.description}</p>
          <p className="tap-hint">Tap to choose · {hintFor(dish, sel)}</p>
        </div>
      </button>
    </article>
  );
}

function hintFor(dish: Dish, sel: { pieces?: number; sauce?: string }) {
  const kind = dish.kind;
  if (kind.type === "roll") {
    const n = kind.proteins[0] ? Object.keys(kind.proteins[0].prices).length : 0;
    const proteins = kind.proteins.length;
    if (proteins > 1) return "Protein & pieces";
    if (n > 1) return `${Object.keys(kind.proteins[0].prices).join(" / ")} pcs`;
  }
  if (kind.type === "sauce-price") return "Sauce changes the price";
  if (kind.type === "spicy-toggle") return "Spicy or not";
  if (kind.type === "deal-box") return "Pick starter & sushi";
  if (kind.type === "party-box") return "Pick your starter";
  if (kind.type === "addons") return "Add-ons available";
  if (kind.type === "size-price") return "Size & flavour";
  if (sel.sauce) return sel.sauce;
  return "Add to ticket";
}
