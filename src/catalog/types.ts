import type { z } from "zod";
import type { dishSchema, menuSchema } from "@/cms/schema";

export type Dish = z.infer<typeof dishSchema>;
export type DishKind = Dish["kind"];
export type Section = Dish["section"];
export type Tag = Dish["tags"][number];
export type DietFilter = z.infer<typeof menuSchema>["filters"][number]["id"];

type Kind<T extends DishKind["type"]> = Extract<DishKind, { type: T }>;

export type Choice = Kind<"deal-box">["starters"][number];
export type Extra = NonNullable<Dish["extras"]>[number];
export type ChoiceGroup = NonNullable<Kind<"roll">["topping"]>;
export type IncludedPicks = NonNullable<Kind<"addons">["includedPicks"]>;
export type Protein = Kind<"roll">["proteins"][number];
export type SaucePrice = Kind<"sauce-price">["sauces"][number];
export type SizePrice = Kind<"size-price">["sizes"][number];
export type PiecePrices = Protein["prices"];

// Selections store the count as a number. The schema keys each price with that count's digits.
export type PieceCount = 4 | 6 | 8 | 12 | 24;

export type Selection = {
  protein?: string;
  pieces?: PieceCount;
  sauce?: string;
  spicy?: boolean;
  size?: string;
  flavor?: string;
  starter?: string;
  sushi?: string;
  starters?: string[];
  extras?: string[];
  picks?: string[];
  topping?: string;
  style?: string;
  cut?: string;
  dip?: string;
};
