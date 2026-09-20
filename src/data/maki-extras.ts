import type { Dish } from "./types";
import { IMG, MAKI_FILLINGS, SPICY_OR_NOT } from "./shared";

const maki = (four: number) => ({
  4: four,
  6: four * 1.5,
  8: four * 2,
  12: four * 3,
  24: four * 6,
});

export const MAKI: Dish[] = [
  {
    id: "tempura-roll",
    name: "Tempura roll",
    nameAr: "رول تمبورا",
    section: "Sushinaa maki",
    description: "Shrimp tempura. Choose cheese, mayo, or spicy mayo.",
    image: IMG("tempura-roll.jpg"),
    tags: ["seafood"],
    kind: {
      type: "roll",
      proteins: [{ id: "tempura", name: "Tempura shrimp", seafood: true, prices: maki(24) }],
      topping: { id: "topping", name: "Filling", options: MAKI_FILLINGS },
    },
  },
  {
    id: "cheese-roll",
    name: "Cheese roll",
    nameAr: "رول الجبن",
    section: "Sushinaa maki",
    description: "Cheese. Vegetarian.",
    image: IMG("cheese-maki.jpg"),
    tags: ["veg"],
    kind: {
      type: "roll",
      proteins: [{ id: "cheese", name: "Cheese", veg: true, prices: maki(24) }],
      style: { id: "style", name: "Heat", options: SPICY_OR_NOT },
    },
  },
  {
    id: "carrot-roll",
    name: "Carrot roll",
    nameAr: "رول الجزر",
    section: "Sushinaa maki",
    description: "Carrot. Vegetarian. Choose cheese, mayo, or spicy mayo.",
    image: IMG("carrot-maki.jpg"),
    tags: ["veg"],
    kind: {
      type: "roll",
      proteins: [{ id: "carrot", name: "Carrot", veg: true, prices: maki(24) }],
      topping: { id: "topping", name: "Filling", options: MAKI_FILLINGS },
    },
  },
  {
    id: "avocado-roll",
    name: "Avocado roll",
    nameAr: "رول الأفوكادو",
    section: "Sushinaa maki",
    description: "Avocado. Vegetarian. Choose cheese, mayo, or spicy mayo.",
    image: IMG("avocado-roll.jpg"),
    tags: ["veg"],
    kind: {
      type: "roll",
      proteins: [{ id: "avocado", name: "Avocado", veg: true, prices: maki(24) }],
      topping: { id: "topping", name: "Filling", options: MAKI_FILLINGS },
    },
  },
  {
    id: "cucumber-roll",
    name: "Cucumber roll",
    nameAr: "رول الخيار",
    section: "Sushinaa maki",
    description: "Cucumber. Vegetarian. Choose cheese, mayo, or spicy mayo.",
    image: IMG("cucumber-maki.jpg"),
    tags: ["veg"],
    kind: {
      type: "roll",
      proteins: [{ id: "cucumber", name: "Cucumber", veg: true, prices: maki(24) }],
      topping: { id: "topping", name: "Filling", options: MAKI_FILLINGS },
    },
  },
  {
    id: "crabsticks-roll",
    name: "Crab sticks roll",
    nameAr: "رول كراب ستيكس",
    section: "Sushinaa maki",
    description: "Crab sticks and mayo. Regular, spicy, or crispy.",
    image: IMG("crabsticks-roll.jpg"),
    tags: ["seafood"],
    kind: {
      type: "roll",
      proteins: [{ id: "crab", name: "Crab", seafood: true, prices: maki(24) }],
      style: {
        id: "style",
        name: "Style",
        options: [
          { id: "regular", name: "Regular", image: IMG("crabsticks-roll.jpg") },
          { id: "spicy", name: "Spicy", spicy: true, image: IMG("crabsticks-roll.jpg") },
          { id: "crispy", name: "Crispy", image: IMG("crabsticks-roll-crispy.jpg") },
        ],
      },
    },
  },
  {
    id: "vegi-sushi",
    name: "Vegi sushi",
    nameAr: "سوشي خضار",
    section: "Sushinaa maki",
    description:
      "Bell pepper, carrot, lettuce, avocado, cucumber, rice, nori. Not spicy or crispy.",
    image: IMG("vegi-roll.jpg"),
    tags: ["veg"],
    kind: {
      type: "roll",
      proteins: [{ id: "vegi", name: "Veggie", veg: true, prices: maki(24) }],
      style: {
        id: "style",
        name: "Style",
        options: [
          { id: "not-spicy", name: "Not spicy" },
          { id: "crispy", name: "Crispy" },
        ],
      },
    },
  },
];

export const SAUCES: Dish[] = [
  {
    id: "sauces",
    name: "Extra sauce",
    nameAr: "الصوصات",
    section: "Sauces",
    description: "Small 1oz or big 2oz. Pick the sauce.",
    image: IMG("extra-sauce.jpg"),
    tags: ["veg"],
    kind: {
      type: "size-price",
      sizes: [
        { id: "small", name: "Small 1oz", nameAr: "صغير", priceQar: 3 },
        { id: "big", name: "Big 2oz", nameAr: "كبير", priceQar: 5 },
      ],
      flavors: {
        id: "flavor",
        name: "Sauce",
        options: [
          { id: "soya", name: "Soya" },
          { id: "sweet-chili", name: "Sweet chili" },
          { id: "mayo", name: "Mayo" },
          { id: "bbq", name: "BBQ" },
          { id: "sushinaa", name: "Sushinaa sauce" },
          { id: "spicy-mayo", name: "Spicy mayo", spicy: true },
          { id: "sweet-n-spicy", name: "Sweet n spicy", spicy: true },
          { id: "dynamite", name: "Dynamite", spicy: true },
        ],
      },
    },
  },
];

export const DRINKS: Dish[] = [
  {
    id: "redbull",
    name: "Red Bull",
    nameAr: "ريد بُل",
    section: "Drinks",
    description: "250ml.",
    image: IMG("redbull.jpg"),
    tags: ["veg"],
    kind: { type: "simple", priceQar: 15 },
  },
  {
    id: "water",
    name: "Still water",
    nameAr: "مياه معدنية",
    section: "Drinks",
    description: "Small 330ml or big 500ml.",
    image: IMG("still-water.jpg"),
    tags: ["veg"],
    kind: {
      type: "size-price",
      sizes: [
        { id: "small", name: "330ml", priceQar: 3 },
        { id: "big", name: "500ml", priceQar: 5 },
      ],
    },
  },
  {
    id: "kinza",
    name: "Kinza",
    nameAr: "كينزا",
    section: "Drinks",
    description: "Small 185ml or big 250ml. Pick a flavour.",
    image: IMG("kinza.jpg"),
    tags: ["veg"],
    kind: {
      type: "size-price",
      sizes: [
        { id: "small", name: "185ml", priceQar: 3 },
        { id: "big", name: "250ml", priceQar: 5 },
      ],
      flavors: {
        id: "flavor",
        name: "Flavour",
        options: [
          { id: "cola", name: "Cola" },
          { id: "diet", name: "Diet cola" },
          { id: "pomegranate", name: "Pomegranate" },
          { id: "lemon", name: "Lemon" },
          { id: "blackcurrant", name: "Blackcurrant" },
          { id: "orange", name: "Orange" },
          { id: "citrus", name: "Citrus" },
        ],
      },
    },
  },
  {
    id: "shani",
    name: "Shani",
    nameAr: "شاني",
    section: "Drinks",
    description: "250ml.",
    image: IMG("shani.jpg"),
    tags: ["veg"],
    kind: { type: "simple", priceQar: 5 },
  },
];
