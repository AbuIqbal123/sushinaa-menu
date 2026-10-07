export function formatQar(
  amount: number,
  lang: "en" | "ar",
  currency: { currencyEn: string; currencyAr: string },
): string {
  const n = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  return `${n} ${lang === "ar" ? currency.currencyAr : currency.currencyEn}`;
}
