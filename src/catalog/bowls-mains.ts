import type { Dish } from "./types";
import { IMG, NOODLE_VEG_EXTRAS } from "./shared";

export const FRIED_RICE: Dish[] = [
  {
    id: "chicken-fried-rice",
    name: "Chicken fried rice",
    nameAr: "أرز مقلي بالدجاج",
    section: "Fried rice",
    description:
      "Chicken, rice, soy sauce, yellow pepper, green pepper, red pepper, mushroom, carrot, black pepper.",
    image: IMG("chicken-fried-rice.jpg"),
    tags: [],
    kind: { type: "simple", priceQar: 48 },
  },
  {
    id: "beef-fried-rice",
    name: "Beef fried rice",
    nameAr: "أرز مقلي باللحم",
    section: "Fried rice",
    description:
      "Beef, rice, soy sauce, yellow pepper, green pepper, red pepper, mushroom, carrot, black pepper.",
    image: IMG("beef-fried-rice.jpg"),
    tags: [],
    kind: { type: "simple", priceQar: 48 },
  },
  {
    id: "shrimp-fried-rice",
    name: "Shrimp fried rice",
    nameAr: "أرز مقلي بالجمبري",
    section: "Fried rice",
    description:
      "Shrimp, rice, soy sauce, yellow pepper, green pepper, red pepper, mushroom, carrot, black pepper.",
    image: IMG("shrimp-fried-rice.jpg"),
    tags: ["seafood"],
    kind: { type: "simple", priceQar: 52 },
  },
  {
    id: "vegi-fried-rice",
    name: "Vegetable fried rice",
    nameAr: "أرز مقلي بالخضار",
    section: "Fried rice",
    description:
      "Rice, soy sauce, yellow pepper, green pepper, red pepper, mushroom, carrot, black pepper.",
    image: IMG("vegi-fried-rice.jpg"),
    tags: ["veg"],
    kind: { type: "simple", priceQar: 40 },
  },
];

export const POKE: Dish[] = [
  {
    id: "veggie-poke",
    name: "Veggie poke bowl",
    nameAr: "بوك بول خضار",
    section: "Poke bowls",
    description:
      "Rice, cucumber, edamame, avocado, mango, white cabbage, red cabbage, breadcrumbs, nori. Crispy potato on the side.",
    image: IMG("vegi-poke-bowl.jpg"),
    tags: ["veg"],
    kind: { type: "simple", priceQar: 35 },
  },
  {
    id: "chicken-poke",
    name: "Chicken poke bowl",
    nameAr: "بوك بول دجاج",
    section: "Poke bowls",
    description:
      "Crispy chicken with sauce, rice, cucumber, corn, avocado, white cabbage, red cabbage, nori. Crispy potato on the side.",
    image: IMG("chicken-poke-bowl.jpg"),
    tags: [],
    kind: { type: "simple", priceQar: 50 },
  },
  {
    id: "shrimp-poke",
    name: "Shrimp poke bowl",
    nameAr: "بوك بول روبيان",
    section: "Poke bowls",
    description:
      "Crispy shrimp with sauce, rice, cucumber, edamame, avocado, crab, mayonnaise, caviar, corn, nori. Crispy potato on the side.",
    image: IMG("shrimp-poke-bowl.jpg"),
    tags: ["seafood"],
    kind: { type: "simple", priceQar: 55 },
  },
];

export const SALADS: Dish[] = [
  {
    id: "spicy-mango-salad",
    name: "Spicy mango salad",
    nameAr: "سلطة مانجو حارة",
    section: "Salads",
    description:
      "Crab sticks, mango, cucumber, lettuce, black sesame, crispy wonton, spicy sauce.",
    image: IMG("spicy-mango-salad.jpg"),
    tags: ["seafood", "spicy"],
    kind: { type: "simple", priceQar: 36 },
  },
  {
    id: "crunchy-crab-salad",
    name: "Crunchy crab salad",
    nameAr: "سلطة كراب مقرمشة",
    section: "Salads",
    description: "Crab, lettuce, caviar, nori, breadcrumbs, mayonnaise, cucumber.",
    image: IMG("crunchy-crab-salad.jpg"),
    tags: ["seafood"],
    kind: {
      type: "addons",
      priceQar: 39,
      extras: [{ id: "make-spicy", name: "Make it spicy", nameAr: "حار", priceQar: 3 }],
      spicyOptional: false,
    },
  },
];

export const MAINS: Dish[] = [
  {
    id: "honey-glaze-chicken",
    name: "Honey glaze chicken",
    nameAr: "دجاج بصلصة العسل",
    section: "Mains",
    description: "Honey chicken, rice, avocado, sesame, spring onion.",
    image: IMG("glazed-honey-chicken.jpg"),
    tags: [],
    kind: { type: "simple", priceQar: 45 },
    extras: [
      { id: "extra-chicken", name: "Extra chicken", nameAr: "دجاج إضافي", priceQar: 7 },
      { id: "extra-rice", name: "Extra rice", nameAr: "أرز إضافي", priceQar: 3 },
      { id: "extra-avocado", name: "Extra avocado", nameAr: "أفوكادو إضافي", priceQar: 3 },
    ],
  },
  {
    id: "honey-glaze-salmon",
    name: "Honey glaze salmon",
    nameAr: "سلمون بصلصة العسل",
    section: "Mains",
    description: "Honey salmon, rice, avocado, sesame, spring onion.",
    image: IMG("glazed-honey-salmon.jpg"),
    tags: ["seafood"],
    kind: { type: "simple", priceQar: 48 },
    extras: [
      { id: "extra-salmon", name: "Extra salmon", nameAr: "سلمون إضافي", priceQar: 7 },
      { id: "extra-rice", name: "Extra rice", nameAr: "أرز إضافي", priceQar: 3 },
      { id: "extra-avocado", name: "Extra avocado", nameAr: "أفوكادو إضافي", priceQar: 3 },
    ],
  },
];

export const NOODLES: Dish[] = [
  {
    id: "chicken-noodles",
    name: "Chicken noodles",
    nameAr: "نودلز دجاج",
    section: "Noodles",
    description:
      "Chicken breast, bell pepper, carrot, red cabbage, onion, garlic, sauce. Spicy optional.",
    image: IMG("chicken-noodles.jpg"),
    tags: [],
    kind: {
      type: "addons",
      priceQar: 50,
      spicyOptional: true,
      extras: [
        { id: "extra-chicken", name: "Extra chicken", nameAr: "دجاج", priceQar: 5 },
        ...NOODLE_VEG_EXTRAS,
      ],
    },
  },
  {
    id: "shrimp-noodles",
    name: "Shrimp noodles",
    nameAr: "نودلز روبيان",
    section: "Noodles",
    description:
      "Shrimp, bell pepper, carrot, red cabbage, onion, garlic, sauce. Spicy optional.",
    image: IMG("shrimp-noodles.jpg"),
    tags: ["seafood"],
    kind: {
      type: "addons",
      priceQar: 52,
      spicyOptional: true,
      extras: [
        { id: "extra-shrimp", name: "Extra shrimp", nameAr: "روبيان", priceQar: 5 },
        ...NOODLE_VEG_EXTRAS,
      ],
    },
  },
  {
    id: "beef-noodles",
    name: "Beef noodles",
    nameAr: "نودلز لحم بقري",
    section: "Noodles",
    description:
      "Beef, bell pepper, carrot, red cabbage, onion, garlic, sauce. Spicy optional.",
    image: IMG("beef-noodles.jpg"),
    tags: [],
    kind: {
      type: "addons",
      priceQar: 55,
      spicyOptional: true,
      extras: [
        { id: "extra-beef", name: "Extra beef", nameAr: "لحم", priceQar: 5 },
        ...NOODLE_VEG_EXTRAS,
      ],
    },
  },
  {
    id: "veggie-noodles",
    name: "Veggie noodles",
    nameAr: "نودلز خضار",
    section: "Noodles",
    description:
      "Bell pepper, carrot, red cabbage, onion, garlic, sauce. Spicy optional.",
    image: IMG("vegi-noodles.jpg"),
    tags: ["veg"],
    kind: {
      type: "addons",
      priceQar: 45,
      spicyOptional: true,
      extras: [...NOODLE_VEG_EXTRAS],
    },
  },
];
