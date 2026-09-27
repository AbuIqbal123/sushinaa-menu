import type { CategoryFilter, DietFilter, Dish, Section } from "./types";
import { NEW_DISHES } from "./new-menu";
import { STARTERS } from "./starters";
import { FRIED_RICE, MAINS, NOODLES, POKE, SALADS } from "./bowls-mains";
import { BURRITO, DEAL_BOXES, PARTY_BOXES } from "./boxes";
import { ROLLS } from "./rolls";
import { DRINKS, MAKI, SAUCES } from "./maki-extras";
import { dishIsSeafood, dishIsSpicy, dishIsVeg, selectionForDiet } from "@/lib/price";

export type { DietFilter, Dish, Section, CategoryFilter } from "./types";

export const DISHES: Dish[] = [
  ...NEW_DISHES,
  ...STARTERS,
  ...FRIED_RICE,
  ...POKE,
  ...DEAL_BOXES,
  ...SALADS,
  ...MAINS,
  ...ROLLS,
  ...BURRITO,
  ...MAKI,
  ...NOODLES,
  ...PARTY_BOXES,
  ...SAUCES,
  ...DRINKS,
];

export const DISH_BY_ID = Object.fromEntries(DISHES.map((d) => [d.id, d])) as Record<
  string,
  Dish
>;

export const CATEGORY_CHIPS: { id: Section; label: string }[] = [
  { id: "New", label: "New" },
  { id: "Starters", label: "Starters" },
  { id: "Fried rice", label: "Fried rice" },
  { id: "Poke bowls", label: "Poke" },
  { id: "Deal box", label: "Deal box" },
  { id: "Salads", label: "Salads" },
  { id: "Mains", label: "Mains" },
  { id: "Sushina rolls", label: "Rolls" },
  { id: "Sushi burrito", label: "Burrito" },
  { id: "Sushinaa maki", label: "Maki" },
  { id: "Noodles", label: "Noodles" },
  { id: "Sushinaa box", label: "Boxes" },
  { id: "Sauces", label: "Sauces" },
  { id: "Drinks", label: "Drinks" },
];

export const DIET_CHIPS: { id: DietFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "veg", label: "Veg" },
  { id: "spicy", label: "Spicy" },
  { id: "seafood", label: "Seafood" },
];

export function matchesDiet(dish: Dish, filter: DietFilter): boolean {
  if (filter === "all") return true;
  const sel = selectionForDiet(dish, filter);
  if (filter === "veg") {
    if (dish.kind.type === "roll") return dish.kind.proteins.some((p) => p.veg);
    return dishIsVeg(dish, sel);
  }
  if (filter === "spicy") {
    if (dish.kind.type === "sauce-price") return dish.kind.sauces.some((s) => s.spicy);
    if (dish.kind.type === "spicy-toggle") return true;
    if (dish.kind.type === "addons" && dish.kind.spicyOptional) return true;
    return dishIsSpicy(dish, sel) || dish.tags.includes("spicy");
  }
  if (filter === "seafood") {
    if (dish.kind.type === "roll") return dish.kind.proteins.some((p) => p.seafood);
    return dishIsSeafood(dish, sel) || dish.tags.includes("seafood");
  }
  return true;
}

export { SITE } from "@/lib/site";
