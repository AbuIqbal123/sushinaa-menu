import { DESC_AR } from "@/data/desc-ar";
import type { Dish, Section } from "@/data/types";

export type Lang = "en" | "ar";

export function pickName(item: { name: string; nameAr?: string }, lang: Lang): string {
  if (lang === "ar" && item.nameAr) return item.nameAr;
  if (lang === "ar" && OPTION_AR[item.name]) return OPTION_AR[item.name];
  return item.name;
}

export function dishDescription(dish: Pick<Dish, "id" | "description" | "descriptionAr">, lang: Lang): string {
  if (lang === "en") return dish.description;
  return dish.descriptionAr || DESC_AR[dish.id] || dish.description;
}

export function sectionName(section: Section, lang: Lang): string {
  if (lang === "en") return SECTION_EN[section];
  return SECTION_AR[section];
}

const SECTION_EN: Record<Section, string> = {
  Starters: "Starters",
  "Fried rice": "Fried rice",
  "Poke bowls": "Poke",
  "Deal box": "Deal box",
  Salads: "Salads",
  Mains: "Mains",
  "Sushina rolls": "Rolls",
  "Sushi burrito": "Burrito",
  "Sushinaa maki": "Maki",
  Noodles: "Noodles",
  "Sushinaa box": "Boxes",
  Sauces: "Sauces",
  Drinks: "Drinks",
};

const SECTION_AR: Record<Section, string> = {
  Starters: "المقبلات",
  "Fried rice": "أرز مقلي",
  "Poke bowls": "بوكي",
  "Deal box": "بوكس العرض",
  Salads: "السلطات",
  Mains: "الأطباق الرئيسية",
  "Sushina rolls": "رولز",
  "Sushi burrito": "بوريتو",
  "Sushinaa maki": "ماكي",
  Noodles: "نودلز",
  "Sushinaa box": "بوكسات",
  Sauces: "الصوصات",
  Drinks: "المشروبات",
};

/** English option labels that are not already stored as nameAr. */
const OPTION_AR: Record<string, string> = {
  "Shrimp tempura": "روبيان تيمبورا",
  "Shrimp dynamite": "روبيان ديناميت",
  "Shrimp sweet n sour": "روبيان سويت آند ساور",
  "Shrimp sweet n spicy": "روبيان حلو وحار",
  "Shrimp BBQ": "روبيان باربكيو",
  "Classic cherry roll": "كلاسيك تشيري رول",
  "Tiger roll (shrimp)": "تايغر رول (روبيان)",
  "Tempura California roll": "تمبورا كاليفورنيا رول",
  "October roll (shrimp)": "أكتوبر رول (روبيان)",
  "Chicken dynamite": "دجاج ديناميت",
  "Chicken sweet n spicy": "دجاج حلو وحار",
  "Chicken BBQ": "دجاج باربكيو",
  "Chicken mayo roll": "رول دجاج مايونيز",
  "HBA chicken roll": "رول إتش بي إيه دجاج",
  "Chips Oman roll": "رول شيبس عمان",
  "Crab rangoon": "كراب رانغون",
  "Crunchy crab salad": "سلطة كراب مقرمشة",
  "Blue roll": "بلو رول",
  "Cereal-killer roll": "رول سيريال كيلر",
  "Crazy salmon roll": "رول كريزي سلمون",
  "CSC roll": "رول سي إس سي",
  "Salt edamame": "إدامامي مالح",
  "Spicy edamame": "إدامامي حار",
  "Lettuce roll": "رول خس",
  "Avocado roll": "رول أفوكادو",
  "Veggie roll": "رول خضار",
  "Mario roll": "ماريو رول",
  Shrimp: "روبيان",
  Chicken: "دجاج",
  Salmon: "سلمون",
  Crab: "سلطعون",
  "Tempura shrimp": "روبيان تيمبورا",
  Seafood: "بحري",
  Cheese: "جبن",
  Carrot: "جزر",
  Cucumber: "خيار",
  Spicy: "حار",
  Regular: "عادي",
  Crispy: "مقرمش",
  Veggie: "خضار",
  "Sweet chili": "سويت تشيلي",
  Mayo: "مايونيز",
  BBQ: "باربكيو",
  "Sushinaa sauce": "صوص سوشينا",
  "Spicy mayo": "مايونيز حار",
  "Sweet n spicy": "حلو وحار",
  Dynamite: "ديناميت",
  "Diet cola": "كولا دايت",
  Pomegranate: "رمان",
  Lemon: "ليمون",
  Blackcurrant: "كشمش أسود",
  Orange: "برتقال",
  Citrus: "حمضيات",
  "Shrimp kunafa": "روبيان كنافة",
  "Spicy mango salad": "سلطة مانجو حارة",
  "Not cut": "بدون تقطيع",
  "Cut in half": "نصفين",
  "Cut in four": "أربعة",
  None: "بدون",
  Sesame: "سمسم",
  "Orange caviar": "كفيار برتقالي",
  Mushroom: "فطر",
  "Extra sauce": "صوص إضافي",
  Onion: "بصل",
  Cabbage: "ملفوف",
  "Bell pepper": "فلفل رومي",
  "330ml": "٣٣٠ مل",
  "500ml": "٥٠٠ مل",
  "185ml": "١٨٥ مل",
  "250ml": "٢٥٠ مل",
  "Small 1oz": "صغير",
  "Big 2oz": "كبير",
  Soya: "صويا",
  Cola: "كولا",
};

export const FIELD_AR: Record<string, string> = {
  Sauce: "الصوص",
  Heat: "الحرارة",
  Protein: "البروتين",
  Pieces: "القطع",
  Starter: "المقبلات",
  Starters: "المقبلات",
  Sushi: "السوشي",
  Size: "الحجم",
  Dip: "الصوص",
  Flavour: "النكهة",
  Cut: "التقطيع",
  Style: "النوع",
  Filling: "الحشوة",
  Topping: "الإضافة",
  "Add-ons": "إضافات",
};

export function fieldLabel(label: string, lang: Lang): string {
  if (lang === "ar" && FIELD_AR[label]) return FIELD_AR[label];
  return label;
}
