import type { CmsDish } from "@/cms/schema";
type Kind = CmsDish["kind"]["type"];
export const kindLabels: Record<Kind, string> = {
  simple: "Fixed price",
  "spicy-toggle": "Regular / spicy prices",
  "sauce-price": "Price by sauce",
  roll: "Protein & portions",
  "deal-box": "Starter & sushi box",
  "party-box": "Party box",
  "size-price": "Sizes & flavours",
  addons: "Add-ons & included choices",
};
// One plain line per pricing kind, using a real dish from the live menu
// (another dish than the one being edited when there is one).
export function pricingExample(
  type: string,
  dishes: CmsDish[],
  currency: string,
  skip?: string,
): string {
  const d =
    dishes.find((x) => x.kind.type === type && x.id !== skip) ??
    dishes.find((x) => x.kind.type === type);
  if (!d) return "No dish on the menu is priced this way yet.";
  const q = (n: number) => `${n} ${currency}`;
  const k = d.kind;
  switch (k.type) {
    case "simple":
      return `One price. ${d.name} is ${q(k.priceQar)}.`;
    case "spicy-toggle":
      return `Regular or spicy, each with its own price. ${d.name} is ${q(k.mildQar)} regular, ${q(k.spicyQar)} spicy.`;
    case "sauce-price": {
      const [a, b] = k.sauces;
      return `The sauce sets the price. ${d.name} with ${a.name} is ${q(a.priceQar)}${b ? `, with ${b.name} ${q(b.priceQar)}` : ""}.`;
    }
    case "roll": {
      const p = k.proteins[0];
      const [n, price] = Object.entries(p.prices).sort(
        (x, y) => Number(x[0]) - Number(y[0]),
      )[0];
      return `Pick a protein, then a portion. ${d.name} with ${p.name}, ${n} pieces, is ${q(price)}.`;
    }
    case "deal-box":
      return `One price for a starter and a sushi choice. ${d.name} is ${q(k.priceQar)}.`;
    case "party-box": {
      const n =
        k.starterMin === k.starterMax
          ? `${k.starterMax}`
          : `${k.starterMin}–${k.starterMax}`;
      return `One price with ${n} starter${k.starterMax === 1 ? "" : "s"} to choose. ${d.name} is ${q(k.priceQar)}.`;
    }
    case "size-price": {
      const [a, b] = k.sizes;
      return `The size sets the price. ${d.name}: ${a.name} ${q(a.priceQar)}${b ? `, ${b.name} ${q(b.priceQar)}` : ""}.`;
    }
    case "addons": {
      const e = k.extras[0];
      return `A base price plus paid add-ons. ${d.name} is ${q(k.priceQar)}${e ? `; ${e.name} adds ${q(e.priceQar)}` : ""}.`;
    }
  }
}
