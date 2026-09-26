export function formatQar(amount: number, lang: "en" | "ar" = "en"): string {
  const n = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  return lang === "ar" ? `${n} ر.ق` : `${n} QAR`;
}

export function formatQarShort(amount: number): string {
  if (Number.isInteger(amount)) return `${amount}`;
  return amount.toFixed(2);
}
