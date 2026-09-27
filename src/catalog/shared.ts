import type { Choice, Extra } from "./types";

export const IMG = (file: string) => `/dishes/${file}`;

export const FREE_DIPS: Choice[] = [
  { id: "sweet-chili", name: "Sweet chili", nameAr: "سويت تشيلي" },
  { id: "mayo", name: "Mayo", nameAr: "مايونيز" },
  { id: "spicy-mayo", name: "Spicy mayo", nameAr: "مايونيز حار", spicy: true },
  { id: "soya", name: "Soya", nameAr: "صويا" },
  { id: "bbq", name: "BBQ", nameAr: "باربكيو" },
  { id: "sushinaa", name: "Sushinaa sauce", nameAr: "صوص سوشينا" },
  { id: "sweet-n-spicy", name: "Sweet n spicy", nameAr: "حلو وحار", spicy: true },
  { id: "dynamite", name: "Dynamite", nameAr: "ديناميت", spicy: true },
];

export const NOODLE_VEG_EXTRAS: Extra[] = [
  { id: "mushroom", name: "Mushroom", nameAr: "فطر", priceQar: 2 },
  { id: "extra-sauce", name: "Extra sauce", nameAr: "صوص إضافي", priceQar: 2 },
  { id: "onion", name: "Onion", nameAr: "بصل", priceQar: 2 },
  { id: "carrot", name: "Carrot", nameAr: "جزر", priceQar: 2 },
  { id: "bell-pepper", name: "Bell pepper", nameAr: "فلفل رومي", priceQar: 2 },
  { id: "cabbage", name: "Cabbage", nameAr: "ملفوف", priceQar: 2 },
];

export const BOX_STARTERS: Choice[] = [
  { id: "salt-edamame", name: "Salt edamame" },
  { id: "spicy-edamame", name: "Spicy edamame", spicy: true },
  { id: "shrimp-dynamite", name: "Shrimp dynamite", spicy: true },
  { id: "shrimp-sns", name: "Shrimp sweet n spicy", spicy: true },
  { id: "shrimp-bbq", name: "Shrimp BBQ" },
  { id: "chicken-dynamite", name: "Chicken dynamite", spicy: true },
  { id: "chicken-sns", name: "Chicken sweet n spicy", spicy: true },
  { id: "chicken-bbq", name: "Chicken BBQ" },
  { id: "shrimp-kunafa", name: "Shrimp kunafa" },
  { id: "shrimp-tempura", name: "Shrimp tempura" },
  { id: "crab-salad", name: "Crunchy crab salad" },
  { id: "mango-salad", name: "Spicy mango salad", spicy: true },
  { id: "crab-rangoon", name: "Crab rangoon" },
];

export const MAKI_FILLINGS: Choice[] = [
  { id: "cheese", name: "Cheese", nameAr: "جبن" },
  { id: "mayo", name: "Mayo", nameAr: "مايونيز" },
  { id: "spicy-mayo", name: "Spicy mayo", nameAr: "مايونيز حار", spicy: true },
];

export const SPICY_OR_NOT: Choice[] = [
  { id: "spicy", name: "Spicy", nameAr: "حار", spicy: true },
  { id: "not-spicy", name: "Regular", nameAr: "عادي" },
];

export const CALI_TOPPING: Choice[] = [
  { id: "sesame", name: "Sesame", nameAr: "سمسم" },
  { id: "orange-caviar", name: "Orange caviar", nameAr: "كفيار برتقالي" },
  { id: "none", name: "None", nameAr: "بدون" },
];

export const BURRITO_CUT: Choice[] = [
  { id: "not-cut", name: "Not cut", nameAr: "بدون تقطيع" },
  { id: "half", name: "Cut in half", nameAr: "نصفين" },
  { id: "four", name: "Cut in four", nameAr: "أربعة" },
];
