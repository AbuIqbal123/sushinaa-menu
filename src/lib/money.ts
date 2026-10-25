export function formatQar(
  amount: number,
  lang: "en" | "ar",
  currency: { currencyEn: string; currencyAr: string },
): string {
  const n = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  return `${n} ${lang === "ar" ? currency.currencyAr : currency.currencyEn}`;
}

/** Integer minor units (dirhams) as a fixed 2-decimal amount: 4800 -> "48.00", -480 -> "-4.80". No float maths. */
export function minorAmount(minor: number): string {
  if (!Number.isSafeInteger(minor)) throw new RangeError("Money must be an integer number of minor units");
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  return `${sign}${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** A change in minor units with an explicit sign: "+45.00", "-4.80", "0.00". */
export function signedMinorAmount(minor: number): string {
  return minor > 0 ? `+${minorAmount(minor)}` : minorAmount(minor);
}

/** Minor units with the currency, always 2 decimals: "48.00 QAR" / "48.00 ر.ق". */
export function formatMinor(
  minor: number,
  lang: "en" | "ar",
  currency: { currencyEn: string; currencyAr: string } = { currencyEn: "QAR", currencyAr: "ر.ق" },
): string {
  return `${minorAmount(minor)} ${lang === "ar" ? currency.currencyAr : currency.currencyEn}`;
}
