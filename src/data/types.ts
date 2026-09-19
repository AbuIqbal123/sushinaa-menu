export type Section =
  | "Starters"
  | "Fried rice"
  | "Poke bowls"
  | "Deal box"
  | "Salads"
  | "Mains"
  | "Sushina rolls"
  | "Sushi burrito"
  | "Sushinaa maki"
  | "Noodles"
  | "Sushinaa box"
  | "Sauces"
  | "Drinks";

export type CategoryFilter = "all" | Section;
export type DietFilter = "all" | "veg" | "spicy" | "seafood";
export type Tag = "veg" | "spicy" | "seafood";

export type PieceCount = 4 | 6 | 8 | 12 | 24;
export type PiecePrices = Partial<Record<PieceCount, number>>;

export type Extra = {
  id: string;
  name: string;
  nameAr?: string;
  priceQar: number;
};

export type Choice = {
  id: string;
  name: string;
  nameAr?: string;
  image?: string;
  spicy?: boolean;
  veg?: boolean;
};

export type ChoiceGroup = {
  id: string;
  name: string;
  nameAr?: string;
  options: Choice[];
};

export type Protein = {
  id: string;
  name: string;
  nameAr?: string;
  image?: string;
  veg?: boolean;
  spicy?: boolean;
  seafood?: boolean;
  prices: PiecePrices;
};

export type SaucePrice = {
  id: string;
  name: string;
  nameAr?: string;
  spicy?: boolean;
  priceQar: number;
};

export type SizePrice = {
  id: string;
  name: string;
  nameAr?: string;
  priceQar: number;
};

export type DishKind =
  | { type: "simple"; priceQar: number }
  | { type: "spicy-toggle"; mildQar: number; spicyQar: number }
  | {
      type: "sauce-price";
      sauces: SaucePrice[];
      freeDips?: Choice[];
    }
  | {
      type: "roll";
      proteins: Protein[];
      topping?: ChoiceGroup;
      style?: ChoiceGroup;
    }
  | {
      type: "deal-box";
      priceQar: number;
      starters: Choice[];
      sushi: Choice[];
    }
  | {
      type: "party-box";
      priceQar: number;
      starterMin: number;
      starterMax: number;
      starters: Choice[];
    }
  | {
      type: "size-price";
      sizes: SizePrice[];
      flavors?: ChoiceGroup;
    }
  | {
      type: "addons";
      priceQar: number;
      extras: Extra[];
      spicyOptional?: boolean;
      freeChoices?: ChoiceGroup[];
    };

export type Dish = {
  id: string;
  name: string;
  nameAr: string;
  section: Section;
  description: string;
  descriptionAr?: string;
  image: string;
  tags: Tag[];
  kind: DishKind;
  extras?: Extra[];
  freeDips?: Choice[];
  piecesNote?: string;
};

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
  topping?: string;
  style?: string;
  cut?: string;
  dip?: string;
};
