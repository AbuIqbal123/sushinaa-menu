import { z } from "zod";
const text = z.string().max(10000);
const name = z.string().trim().min(1, "Name is required").max(200);
const id = z
  .string()
  .regex(
    /^[a-zA-Z0-9][a-zA-Z0-9 -]{0,99}$/,
    "Use letters, numbers, spaces or hyphens",
  );
const price = z
  .number()
  .finite()
  .min(0)
  .max(100000)
  .refine(
    (n) => Math.abs(n * 100 - Math.round(n * 100)) < 0.00001,
    "Use at most two decimal places",
  );
const image = z
  .string()
  .max(500)
  .regex(
    /^\/(?:dishes|brand|api\/media)\/[a-zA-Z0-9._/-]+$/,
    "Choose an existing image or upload a photo",
  )
  .refine((s) => !s.includes(".."));
const named = { id, name, nameAr: text.optional() };
const choice = z
  .object({
    ...named,
    image: image.optional(),
    spicy: z.boolean().optional(),
    veg: z.boolean().optional(),
  })
  .strict();
const extra = z.object({ ...named, priceQar: price }).strict();
const unique = <T extends { id: string }>(a: T[]) =>
  new Set(a.map((x) => x.id)).size === a.length;
const choices = z
  .array(choice)
  .min(1)
  .max(100)
  .refine(unique, "Option IDs must be unique");
const extras = z
  .array(extra)
  .max(100)
  .refine(unique, "Extra IDs must be unique");
const group = z.object({ ...named, options: choices }).strict();
const prices = z
  .record(z.string().regex(/^(4|6|8|12|24)$/), price)
  .refine((v) => Object.keys(v).length > 0, "Add a portion price");
const protein = z
  .object({
    ...named,
    image: image.optional(),
    spicy: z.boolean().optional(),
    veg: z.boolean().optional(),
    seafood: z.boolean().optional(),
    prices,
  })
  .strict();
const count = z.number().int().min(0).max(20);
const included = z
  .object({
    name,
    nameAr: text.optional(),
    min: count,
    max: count.min(1),
    options: choices,
  })
  .strict()
  .refine((v) => v.min <= v.max, "Minimum cannot exceed maximum");
export const kindSchema = z
  .discriminatedUnion("type", [
    z.object({ type: z.literal("simple"), priceQar: price }).strict(),
    z
      .object({
        type: z.literal("spicy-toggle"),
        mildQar: price,
        spicyQar: price,
      })
      .strict(),
    z
      .object({
        type: z.literal("sauce-price"),
        sauces: z
          .array(
            z
              .object({
                ...named,
                spicy: z.boolean().optional(),
                priceQar: price,
              })
              .strict(),
          )
          .min(1)
          .refine(unique),
        freeDips: choices.optional(),
      })
      .strict(),
    z
      .object({
        type: z.literal("roll"),
        proteins: z.array(protein).min(1).max(100).refine(unique),
        topping: group.optional(),
        style: group.optional(),
      })
      .strict(),
    z
      .object({
        type: z.literal("deal-box"),
        priceQar: price,
        starters: choices,
        sushi: choices,
      })
      .strict(),
    z
      .object({
        type: z.literal("party-box"),
        priceQar: price,
        starterMin: count,
        starterMax: count.min(1),
        starters: choices,
      })
      .strict(),
    z
      .object({
        type: z.literal("size-price"),
        sizes: z.array(extra).min(1).refine(unique),
        flavors: group.optional(),
      })
      .strict(),
    z
      .object({
        type: z.literal("addons"),
        priceQar: price,
        extras,
        spicyOptional: z.boolean().optional(),
        freeChoices: z
          .array(
            group.extend({ id: z.enum(["cut", "style", "topping", "dip"]) }),
          )
          .max(4)
          .refine(unique)
          .optional(),
        includedPicks: included.optional(),
      })
      .strict(),
  ])
  .refine(
    (k) => k.type !== "party-box" || k.starterMin <= k.starterMax,
    "Minimum starters cannot exceed maximum",
  );
export const dishSchema = z
  .object({
    ...named,
    nameAr: text,
    section: id,
    description: text,
    descriptionAr: text.optional(),
    image,
    imageAlt: text,
    imageAltAr: text,
    tags: z
      .array(z.enum(["veg", "spicy", "seafood"]))
      .max(3)
      .refine((v) => new Set(v).size === v.length),
    kind: kindSchema,
    extras: extras.optional(),
    freeDips: choices.optional(),
    piecesNote: text.optional(),
    order: z.number().int().nonnegative(),
    visible: z.boolean(),
    available: z.boolean(),
    updatedAt: text.optional(),
  })
  .strict();
export const categorySchema = z
  .object({
    ...named,
    order: z.number().int().nonnegative(),
    visible: z.boolean(),
    featured: z.boolean(),
  })
  .strict();
export const settingsSchema = z
  .object({
    name,
    nameAr: name,
    tagline: text,
    url: z.url().refine((s) => /^https?:\/\//.test(s)),
    whatsappE164: z.string().regex(/^\d{7,15}$/),
    whatsappDisplay: name,
    instagram: z.url().refine((s) => s.startsWith("https://")),
    instagramHandle: name,
    country: name,
    founded: text,
    areas: z.array(name).max(100),
    addressLine: text,
    logo: image,
    documentLogo: image,
    currencyEn: name,
    currencyAr: name,
  })
  .strict();
export const COPY_KEYS = [
  "langButton",
  "langButtonLabel",
  "brand",
  "whatsapp",
  "tapForDetails",
  "openDetails",
  "skip",
  "viewOrder",
  "addToOrder",
  "added",
  "from",
  "close",
  "closeDetails",
  "closeTicket",
  "clear",
  "total",
  "comment",
  "commentPlaceholder",
  "sendWhatsApp",
  "openingWhatsApp",
  "emptyTicket",
  "yourTicket",
  "noMatch",
  "clearFilters",
  "swipeUp",
  "fewer",
  "more",
  "menu",
  "contact",
  "privacy",
  "terms",
  "backToMenu",
  "filters",
  "category",
  "searchMenu",
  "clearSearch",
  "searchResultsOne",
  "searchResultsOther",
  "viewOnlyNotice",
  "dietary",
  "menuFeed",
  "loading",
  "spicy",
  "regular",
  "veg",
  "seafood",
  "all",
  "dip",
  "pcs",
  "proteinPieces",
  "sauceChanges",
  "spicyOrRegular",
  "pickStarterSushi",
  "pickStarter",
  "addonsAvailable",
  "newOnMenu",
  "pickTwoSauces",
  "saucesIncluded",
  "sizeFlavour",
  "or",
  "pick",
  "ofCount",
  "eachOne",
  "itemNumber",
  "contactTitle",
  "contactFrom",
  "contactLead",
  "name",
  "phone",
  "message",
  "enterName",
  "enterPhone",
  "tellMore",
  "thankTitle",
  "thankBody",
  "missingTitle",
  "missingBody",
  "ticketWord",
  "commentWord",
  "privacyTitle",
  "termsTitle",
  "updated",
  "termsUpdated",
  "openOrderZero",
  "openOrderOne",
  "openOrderOther",
  "inOrderZero",
  "inOrderOne",
  "inOrderOther",
  "fewerOf",
  "moreOf",
  "oneFewer",
  "oneMore",
  "piecesHint",
  "company",
  "menuBlurb",
  "privacyBlurb",
  "termsBlurb",
  "contactBlurb",
  "thankBlurb",
  "missingBlurb",
  "address",
] as const;
export const FIELD_KEYS = [
  "Sauce",
  "Heat",
  "Protein",
  "Pieces",
  "Starter",
  "Starters",
  "Sushi",
  "Size",
  "Dip",
  "Flavour",
  "Cut",
  "Style",
  "Filling",
  "Topping",
  "Add-ons",
  "Sauces",
] as const;
const copySchema = z
  .object(Object.fromEntries(COPY_KEYS.map((k) => [k, text])))
  .strict();
export const menuSchema = z
  .object({
    schemaVersion: z.literal(1),
    categories: z
      .array(categorySchema)
      .max(100)
      .refine(unique, "Category IDs must be unique"),
    dishes: z
      .array(dishSchema)
      .max(2000)
      .refine(unique, "Dish IDs must be unique"),
    settings: settingsSchema,
    copy: z.object({ en: copySchema, ar: copySchema }).strict(),
    fields: z
      .object(
        Object.fromEntries(
          FIELD_KEYS.map((k) => [k, z.object({ name, nameAr: name }).strict()]),
        ),
      )
      .strict(),
    filters: z
      .array(
        z
          .object({
            id: z.enum(["all", "veg", "spicy", "seafood"]),
            order: z.number().int().nonnegative(),
            visible: z.boolean(),
          })
          .strict(),
      )
      .length(4)
      .refine(unique),
  })
  .strict()
  .superRefine((m, ctx) => {
    const ids = new Set(m.categories.map((c) => c.id));
    m.dishes.forEach((d, i) => {
      if (!ids.has(d.section))
        ctx.addIssue({
          code: "custom",
          path: ["dishes", i, "section"],
          message: "Category does not exist",
        });
    });
    if (new Set(m.categories.map((c) => c.order)).size !== m.categories.length)
      ctx.addIssue({
        code: "custom",
        path: ["categories"],
        message: "Category order must be unique",
      });
    for (const c of m.categories) {
      const ds = m.dishes.filter((d) => d.section === c.id);
      if (new Set(ds.map((d) => d.order)).size !== ds.length)
        ctx.addIssue({
          code: "custom",
          path: ["dishes"],
          message: "Item order must be unique within each category",
        });
    }
    if (!m.filters.find((f) => f.id === "all")?.visible)
      ctx.addIssue({
        code: "custom",
        path: ["filters"],
        message: "Keep the All filter enabled",
      });
  });
export type MenuData = z.infer<typeof menuSchema>;
export type CmsDish = z.infer<typeof dishSchema>;
export type Category = z.infer<typeof categorySchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type MenuSnapshot = { revision: number; menu: MenuData };
export function publicMenu(m: MenuData): MenuData {
  const categories = m.categories
    .filter((c) => c.visible)
    .sort((a, b) => a.order - b.order);
  return {
    ...m,
    categories,
    dishes: categories.flatMap((c) =>
      m.dishes
        .filter((d) => d.section === c.id && d.visible && d.available)
        .sort((a, b) => a.order - b.order),
    ),
  };
}
