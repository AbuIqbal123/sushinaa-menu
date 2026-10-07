"use client";

import { memo } from "react";
import Image from "next/image";
import type { DietFilter, Dish } from "@/catalog/menu";
import { useLocale } from "@/i18n/locale";
import { dishDescription, pickName, sectionName as categoryName } from "@/i18n/localize";
import { formatQar as money } from "@/lib/money";
import { useMenu } from "@/cms/context";
import { hasPriceRange, imageFor, selectionForDiet, unitPrice } from "@/ordering/price";
import type { Copy } from "@/i18n/copy";
import { DietTags } from "./DietTags";

type Props = {
  dish: Dish;
  diet?: DietFilter;
  active?: boolean;
  eager?: boolean;
  marked?: boolean;
  showHint?: boolean;
  onOpen: (dish: Dish) => void;
};

export const DishSlide = memo(function DishSlide({
  dish,
  diet = "all",
  active = false,
  eager = false,
  marked = false,
  showHint = false,
  onOpen,
}: Props) {
  const { lang, t } = useLocale();
  const menu=useMenu();
  const formatQar=(n:number,l:"en"|"ar")=>money(n,l,menu.settings);
  const sectionName=(id:string,l:"en"|"ar")=>categoryName(id,l,menu.categories);
  const sel = selectionForDiet(dish, diet);
  const from = hasPriceRange(dish);
  const price = unitPrice(dish, sel);
  const photo = imageFor(dish, sel);
  const title = pickName(dish, lang);
  const description = dishDescription(dish, lang);
  const patterned = photo.startsWith("/brand/");
  const showPhoto = eager || patterned;
  const hint = hintFor(dish, sel, t);

  return (
    <article
      className={`slide${active ? " is-active" : ""}`}
      id={marked ? `dish-${dish.id}` : undefined}
      data-section={dish.section}
      aria-label={`${title}, ${from ? `${t.from} ` : ""}${formatQar(price, lang)}. ${t.tapForDetails}`}
    >
      <button
        type="button"
        className="slide-hit"
        onClick={() => onOpen(dish)}
        aria-label={t.openDetails(title)}
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
            alt={(lang==="ar"?dish.imageAltAr:dish.imageAlt)||`${title}. ${description}`}
            fill
            sizes="(max-width: 430px) 100vw, 430px"
            priority={active}
            unoptimized
            draggable={false}
            className="dish-photo"
            fetchPriority={active ? "high" : "low"}
          />
        ) : (
          <div className="dish-photo-ph" aria-hidden="true" />
        )}
        <div className="scrim" />

        {showHint ? (
          <p className="swipe-hint" aria-hidden="true">
            {t.swipeUp}
            <span className="swipe-chevron">⌃</span>
          </p>
        ) : null}

        <div className="slide-copy">
          <p
            className={
              menu.categories.find(c=>c.id===dish.section)?.featured ? "section-label section-label-new" : "section-label"
            }
          >
            {menu.categories.find(c=>c.id===dish.section)?.featured ? t.newOnMenu : sectionName(dish.section, lang)}
          </p>
          <div className="title-row">
            <h2 className="dish-name">{title}</h2>
            <p className="dish-price">
              {from ? <span className="from">{t.from} </span> : null}
              {formatQar(price, lang)}
            </p>
          </div>
          <DietTags tags={dish.tags} />
          <p className="dish-desc dish-desc-feed">{description}</p>
          {hint ? <p className="tap-hint">{hint}</p> : null}
          <span className="slide-cta">{t.addToOrder}</span>
        </div>
      </button>
    </article>
  );
});

function hintFor(dish: Dish, sel: { pieces?: number; sauce?: string }, t: Copy): string | null {
  const kind = dish.kind;
  if (kind.type === "roll") {
    const n = kind.proteins[0] ? Object.keys(kind.proteins[0].prices).length : 0;
    const proteins = kind.proteins.length;
    if (proteins > 1) return t.proteinPieces;
    if (n > 1) return t.piecesHint(Object.keys(kind.proteins[0].prices).join(" / "));
  }
  if (kind.type === "sauce-price") return t.sauceChanges;
  if (kind.type === "spicy-toggle") return t.spicyOrRegular;
  if (kind.type === "deal-box") return t.pickStarterSushi;
  if (kind.type === "party-box") return t.pickStarter;
  if (kind.type === "addons" && kind.includedPicks) return t.pickTwoSauces;
  if (kind.type === "addons") return t.addonsAvailable;
  if (kind.type === "size-price") return t.sizeFlavour;
  if (sel.sauce) return sel.sauce;
  return null;
}
