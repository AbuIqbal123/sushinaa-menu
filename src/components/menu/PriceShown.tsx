"use client";

import { useLocale } from "@/i18n/locale";
import { formatQar as money } from "@/lib/money";
import { useMenu } from "@/cms/context";
import type { ShownPrice } from "@/ordering/price";

const WAS = { en: "Was", ar: "قبل" } as const;
const NOW = { en: "Now", ar: "الآن" } as const;

/** Sole strikethrough markup for a menu price. "from" prefixes the charge only. */
export function PriceShown({
  price,
  from,
  plus = false,
}: {
  price: ShownPrice;
  from?: string;
  plus?: boolean;
}) {
  const { lang } = useLocale();
  const menu = useMenu();
  const format = (n: number) => money(n, lang, menu.settings);
  const charge = `${plus ? "+" : ""}${format(price.chargeQar)}`;
  if (price.wasQar == null) {
    return (
      <>
        {from ? <span className="from">{from} </span> : null}
        {charge}
      </>
    );
  }
  const was = format(price.wasQar);
  return (
    <>
      {from ? <span className="from">{from} </span> : null}
      <s className="price-was">
        <span className="sr-only">{WAS[lang]} </span>
        {was}
      </s>{" "}
      <span className="price-now">
        <span className="sr-only">{NOW[lang]} </span>
        {charge}
      </span>
    </>
  );
}

/** Spoken price for aria-label. Charge first; was-clause after when on sale. */
export function priceSpoken(
  price: ShownPrice,
  lang: "en" | "ar",
  format: (n: number) => string,
  from?: string,
) {
  const charge = `${from ? `${from} ` : ""}${format(price.chargeQar)}`;
  if (price.wasQar == null) return charge;
  return `${charge}, ${WAS[lang]} ${format(price.wasQar)}`;
}
