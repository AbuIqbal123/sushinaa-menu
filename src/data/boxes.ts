import type { Dish } from "./types";
import { BOX_STARTERS, BURRITO_CUT, IMG } from "./shared";

export const DEAL_BOXES: Dish[] = [
  {
    id: "shrimp-box",
    name: "Shrimp box",
    nameAr: "بوكس روبيان",
    section: "Deal box",
    description:
      "One starter and one sushi type (6 pieces). Shrimp only.",
    descriptionAr: "مقبلات ونوع سوشي (٦ حبات). روبيان فقط.",
    image: IMG("shrimp-deal-box.jpg"),
    tags: ["seafood"],
    kind: {
      type: "deal-box",
      priceQar: 55,
      starters: [
        { id: "shrimp-tempura", name: "Shrimp tempura" },
        { id: "shrimp-dynamite", name: "Shrimp dynamite", spicy: true },
        { id: "shrimp-sns", name: "Shrimp sweet n sour", spicy: true },
        { id: "shrimp-bbq", name: "Shrimp BBQ" },
      ],
      sushi: [
        { id: "classic-cherry", name: "Classic cherry roll" },
        { id: "tiger-shrimp", name: "Tiger roll (shrimp)" },
        { id: "tempura-cali", name: "Tempura California roll" },
        { id: "october-shrimp", name: "October roll (shrimp)", spicy: true },
      ],
    },
  },
  {
    id: "chicken-box",
    name: "Chicken box",
    nameAr: "بوكس دجاج",
    section: "Deal box",
    description: "One starter and one sushi type (6 pieces). Chicken only.",
    descriptionAr: "مقبلات ونوع سوشي (٦ حبات). دجاج فقط.",
    image: IMG("chicken-deal-box.jpg"),
    tags: [],
    kind: {
      type: "deal-box",
      priceQar: 55,
      starters: [
        { id: "chicken-dynamite", name: "Chicken dynamite", spicy: true },
        { id: "chicken-sns", name: "Chicken sweet n spicy", spicy: true },
        { id: "chicken-bbq", name: "Chicken BBQ" },
      ],
      sushi: [
        { id: "chicken-mayo", name: "Chicken mayo roll" },
        { id: "hba", name: "HBA chicken roll" },
        { id: "chips-oman", name: "Chips Oman roll", spicy: true },
      ],
    },
  },
  {
    id: "seafood-box",
    name: "Seafood box",
    nameAr: "بوكس مأكولات بحرية",
    section: "Deal box",
    description: "One starter and one sushi type (6 pieces). Seafood only.",
    descriptionAr: "مقبلات ونوع سوشي (٦ حبات). بحري فقط.",
    image: IMG("seafood-deal-box.jpg"),
    tags: ["seafood"],
    kind: {
      type: "deal-box",
      priceQar: 55,
      starters: [
        { id: "crab-rangoon", name: "Crab rangoon" },
        { id: "crunchy-crab-salad", name: "Crunchy crab salad" },
      ],
      sushi: [
        { id: "blue", name: "Blue roll" },
        { id: "cereal-killer", name: "Cereal-killer roll" },
        { id: "crazy-salmon", name: "Crazy salmon roll", spicy: true },
        { id: "csc", name: "CSC roll" },
      ],
    },
  },
  {
    id: "veggie-box",
    name: "Veggie box",
    nameAr: "بوكس خضار",
    section: "Deal box",
    description: "One starter and one sushi type (6 pieces). Vegetarian only.",
    descriptionAr: "مقبلات ونوع سوشي (٦ حبات). خضار فقط.",
    image: IMG("vegi-deal-box.jpg"),
    tags: ["veg"],
    kind: {
      type: "deal-box",
      priceQar: 55,
      starters: [
        { id: "salt-edamame", name: "Salt edamame" },
        { id: "spicy-edamame", name: "Spicy edamame", spicy: true },
      ],
      sushi: [
        { id: "lettuce", name: "Lettuce roll", veg: true },
        { id: "avocado", name: "Avocado roll", veg: true },
        { id: "veggie", name: "Veggie roll", veg: true },
        { id: "mario", name: "Mario roll", veg: true },
      ],
    },
  },
];

export const PARTY_BOXES: Dish[] = [
  {
    id: "sushinaa-box-mini",
    name: "Sushinaa box mini",
    nameAr: "بوكس سوشينا ميني",
    section: "Sushinaa box",
    description:
      "Nine sushi types, one piece of each, plus one starter of your choice. Serves 1–2. WhatsApp 55075933 for the mix.",
    image: IMG("mini-sushinaa-box.jpg"),
    tags: [],
    kind: {
      type: "party-box",
      priceQar: 110,
      starterMin: 1,
      starterMax: 1,
      starters: BOX_STARTERS,
    },
  },
  {
    id: "sushinaa-box-regular",
    name: "Sushinaa box regular",
    nameAr: "بوكس سوشينا عادي",
    section: "Sushinaa box",
    description:
      "Nine sushi types, two pieces of each, plus 1 or 2 starters of your choice. The same starter twice is fine. Serves 3–4. WhatsApp 55075933 for the mix.",
    image: IMG("sushinaa-box-regular.jpg"),
    tags: [],
    kind: {
      type: "party-box",
      priceQar: 200,
      starterMin: 1,
      starterMax: 2,
      starters: BOX_STARTERS,
    },
  },
];

export const BURRITO: Dish[] = [
  {
    id: "agr-burrito",
    name: "AGR sushi burrito",
    nameAr: "بوريتو سوشي",
    section: "Sushi burrito",
    description:
      "Crab, caviar, shrimp tempura, lettuce, sesame, chips, two sauces.",
    image: IMG("agr-sushi-burrito.jpg"),
    tags: ["seafood"],
    kind: {
      type: "addons",
      priceQar: 55,
      extras: [],
      freeChoices: [{ id: "cut", name: "Cut", nameAr: "التقطيع", options: BURRITO_CUT }],
    },
  },
];
