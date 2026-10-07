import type { DietFilter, Dish } from "./types";
import { dishIsSeafood, dishIsSpicy, dishIsVeg, selectionForDiet } from "@/ordering/price";
export type { DietFilter, Dish, Section } from "./types";
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
