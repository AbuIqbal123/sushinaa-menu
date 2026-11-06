/** True when sale is at least one cent below the base (list) price. */
export function saleIsLower(sale: number, base: number): boolean {
  return Math.round(sale * 100) < Math.round(base * 100);
}
