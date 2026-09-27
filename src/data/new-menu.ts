import type { Choice, Dish, Extra } from "./types";
import { IMG } from "./shared";

const BURGER_SAUCES: Extra[] = [
  { id: "spicy-mayo", name: "Spicy mayo", nameAr: "مايونيز حار", priceQar: 5 },
  { id: "sushinaa", name: "Sushinaa sauce", nameAr: "صوص سوشينا", priceQar: 5 },
  { id: "dynamite", name: "Dynamite", nameAr: "صوص دايناميت", priceQar: 5 },
  { id: "bbq", name: "BBQ", nameAr: "صوص باربكيو", priceQar: 5 },
  { id: "sweet-n-spicy", name: "Sweet n spicy", nameAr: "صوص حلو وحار", priceQar: 5 },
];

const CALAMARI_SAUCES: Extra[] = [
  { id: "lemon-garlic-mayo", name: "Lemon garlic mayo", nameAr: "مايونيز الثوم والليمون", priceQar: 5 },
  { id: "sambal-mayo", name: "Sambal mayo", nameAr: "مايونيز سامبال حار", priceQar: 5 },
];

const GYOZA_SAUCES: Choice[] = [
  { id: "wonton", name: "Sweet wonton", nameAr: "صوص وانتون حلو" },
  { id: "chili-garlic", name: "Chili garlic", nameAr: "صوص الثوم والفلفل الحار", spicy: true },
  { id: "dumpling", name: "Spicy dumpling", nameAr: "صوص دامبلنغ حار", spicy: true },
];

const GYOZA_EXTRAS: Extra[] = [
  { id: "extra-wonton", name: "Extra sweet wonton", nameAr: "صوص وانتون إضافي", priceQar: 5 },
  { id: "extra-chili-garlic", name: "Extra chili garlic", nameAr: "صوص الثوم والفلفل إضافي", priceQar: 5 },
  { id: "extra-dumpling", name: "Extra spicy dumpling", nameAr: "صوص دامبلنغ إضافي", priceQar: 5 },
];

function gyoza(
  id: string,
  name: string,
  nameAr: string,
  description: string,
  descriptionAr: string,
  image: string,
  seafood = false,
): Dish {
  return {
    id,
    name,
    nameAr,
    section: "New",
    description,
    descriptionAr,
    image: IMG(image),
    tags: seafood ? ["seafood"] : [],
    kind: {
      type: "addons",
      priceQar: 44,
      extras: GYOZA_EXTRAS,
      includedPicks: {
        name: "Sauces",
        nameAr: "الصوصات",
        min: 2,
        max: 2,
        options: GYOZA_SAUCES,
      },
    },
  };
}

export const NEW_DISHES: Dish[] = [
  {
    id: "sushinaa-burger",
    name: "Sushinaa burger",
    nameAr: "برجر سوشينا",
    section: "New",
    description:
      "Sushi burger with shrimp, crab stick, avocado, cucumber and spicy mayo, finished with furikake and sweet soy sauce.",
    descriptionAr:
      "برجر سوشي مع الروبيان، أصابع السلطعون، الأفوكادو، الخيار والمايونيز الحار، مزين بالفوريكاكي وصلصة الصويا الحلوة.",
    image: IMG("sushinaa-burger.jpg"),
    tags: ["seafood"],
    kind: { type: "addons", priceQar: 53, extras: BURGER_SAUCES },
  },
  {
    id: "crispy-calamari",
    name: "Crispy calamari",
    nameAr: "كاليماري مقرمش",
    section: "New",
    description:
      "Crispy calamari rings seasoned with garlic and paprika, served with spicy mayo and lemon garlic mayo.",
    descriptionAr:
      "حلقات كاليماري مقرمشة متبلة بالثوم والبابريكا، تقدم مع المايونيز الحار ومايونيز الثوم والليمون.",
    image: IMG("crispy-calamari.jpg"),
    tags: ["seafood"],
    kind: { type: "addons", priceQar: 46, extras: CALAMARI_SAUCES },
  },
  gyoza(
    "gyoza-chicken",
    "Gyoza chicken",
    "جيوزا الدجاج",
    "Chicken-filled gyoza with cabbage, spring onion, garlic and ginger, seasoned with soy and oyster sauce. Served with your choice of 2 sauces.",
    "جيوزا محشوة بالدجاج، الملفوف، البصل الأخضر، الثوم والزنجبيل، متبلة بصلصة الصويا وصلصة المحار، تقدم مع اختيارك من صوصين.",
    "gyoza-chicken.jpg",
  ),
  gyoza(
    "gyoza-beef",
    "Gyoza beef",
    "جيوزا اللحم البقري",
    "Beef-filled gyoza with cabbage, red onion, ginger and garlic, seasoned with soy sauce and sesame oil. Served with your choice of 2 sauces.",
    "جيوزا محشوة باللحم البقري، الملفوف، البصل الأحمر، الزنجبيل والثوم، متبلة بصلصة الصويا وزيت السمسم، تقدم مع اختيارك من صوصين.",
    "gyoza-beef.jpg",
  ),
  gyoza(
    "gyoza-shrimp",
    "Gyoza shrimp",
    "جيوزا الروبيان",
    "Shrimp-filled gyoza with spring onion, seasoned with soy sauce and black pepper for a light, savory flavor. Served with your choice of 2 sauces.",
    "جيوزا محشوة بالروبيان والبصل الأخضر، متبلة بصلصة الصويا والفلفل الأسود لنكهة خفيفة ولذيذة، تقدم مع اختيارك من صوصين.",
    "gyoza-shrimp.jpg",
    true,
  ),
  gyoza(
    "gyoza-seafood",
    "Gyoza seafood",
    "جيوزا المأكولات البحرية",
    "Seafood-filled gyoza with fresh shrimp, crab stick, spring onion and red onion, blended with egg, ginger and garlic for a rich seafood flavor. Served with your choice of 2 sauces.",
    "جيوزا محشوة بالروبيان الطازج، أصابع السلطعون، البصل الأخضر والبصل الأحمر، مع البيض والزنجبيل والثوم لنكهة بحرية غنية، تقدم مع اختيارك من صوصين.",
    "gyoza-seafood.jpg",
    true,
  ),
];
