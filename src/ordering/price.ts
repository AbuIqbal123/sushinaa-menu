import type {
  DietFilter,
  Dish,
  Extra,
  PieceCount,
  PiecePrices,
  Selection,
} from "@/catalog/types";
import type { Copy } from "@/i18n/copy";
import { pickName, type Lang } from "@/i18n/localize";

export function preferredPieces(prices: PiecePrices): PieceCount {
  if (prices[6] != null) return 6;
  if (prices[4] != null) return 4;
  const keys = (Object.keys(prices) as unknown as PieceCount[])
    .map(Number)
    .filter((n) => prices[n as PieceCount] != null) as PieceCount[];
  return keys[0] ?? 4;
}

export function minPriceOf(dish: Dish): number {
  const kind = dish.kind;
  switch (kind.type) {
    case "simple":
      return kind.priceQar;
    case "spicy-toggle":
      return Math.min(kind.mildQar, kind.spicyQar);
    case "sauce-price":
      return Math.min(...kind.sauces.map((s) => s.priceQar));
    case "roll": {
      const all = kind.proteins.flatMap((p) => Object.values(p.prices));
      return Math.min(...all);
    }
    case "deal-box":
    case "party-box":
      return kind.priceQar;
    case "size-price":
      return Math.min(...kind.sizes.map((s) => s.priceQar));
    case "addons":
      return kind.priceQar;
  }
}

export function defaultSelection(dish: Dish): Selection {
  const kind = dish.kind;
  const withDip = (sel: Selection): Selection => {
    if (dish.freeDips?.[0] && !sel.dip) sel.dip = dish.freeDips[0].id;
    return sel;
  };
  switch (kind.type) {
    case "simple":
      return withDip({});
    case "spicy-toggle":
      return withDip({ spicy: false });
    case "sauce-price":
      return withDip({ sauce: kind.sauces[0]?.id });
    case "roll": {
      const protein = kind.proteins[0];
      return withDip({
        protein: protein.id,
        pieces: preferredPieces(protein.prices),
        topping: kind.topping?.options[0]?.id,
        style:
          kind.style?.options.find((o) => o.id === "not-spicy" || o.id === "regular")?.id ??
          kind.style?.options[0]?.id,
      });
    }
    case "deal-box":
      return withDip({
        starter: kind.starters[0]?.id,
        sushi: kind.sushi[0]?.id,
      });
    case "party-box":
      return withDip({ starters: [] });
    case "size-price":
      return withDip({
        size: kind.sizes[0]?.id,
        flavor: kind.flavors?.options[0]?.id,
      });
    case "addons": {
      const sel: Selection = {};
      if (kind.spicyOptional) sel.spicy = false;
      kind.freeChoices?.forEach((g) => {
        const first = g.options[0]?.id;
        if (!first) return;
        if (g.id === "cut") sel.cut = first;
        else if (g.id === "topping") sel.topping = first;
        else if (g.id === "style") sel.style = first;
        else if (g.id === "dip") sel.dip = first;
      });
      return withDip(sel);
    }
  }
}

export function selectionForDiet(dish: Dish, diet: DietFilter): Selection {
  const sel = defaultSelection(dish);
  const kind = dish.kind;
  if (kind.type === "roll") {
    const protein =
      diet === "veg"
        ? kind.proteins.find((p) => p.veg)
        : diet === "seafood"
          ? kind.proteins.find((p) => p.seafood)
          : diet === "spicy"
            ? kind.proteins.find((p) => p.spicy)
            : undefined;
    if (protein) {
      sel.protein = protein.id;
      sel.pieces = preferredPieces(protein.prices);
    }
  }
  if (kind.type === "sauce-price" && diet === "spicy") {
    const spicy = kind.sauces.find((s) => s.spicy);
    if (spicy) sel.sauce = spicy.id;
  }
  if (kind.type === "spicy-toggle" && diet === "spicy") sel.spicy = true;
  if (kind.type === "addons" && kind.spicyOptional && diet === "spicy") sel.spicy = true;
  return sel;
}

function countedChoiceNames(
  ids: string[],
  choices: { id: string; name: string; nameAr?: string }[],
  lang: Lang,
): string {
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  const names: string[] = [];
  for (const [id, n] of counts) {
    const choice = choices.find((item) => item.id === id);
    if (!choice) continue;
    const name = pickName(choice, lang);
    names.push(n > 1 ? `${name} × ${n}` : name);
  }
  return names.join(lang === "ar" ? "، " : ", ");
}

function extraTotal(extras: Extra[] | undefined, selected: string[] | undefined): number {
  if (!extras?.length || !selected?.length) return 0;
  const map = new Map(extras.map((e) => [e.id, e.priceQar]));
  return selected.reduce((sum, id) => sum + (map.get(id) ?? 0), 0);
}

export function unitPrice(dish: Dish, sel: Selection): number {
  const kind = dish.kind;
  const extras = extraTotal(
    kind.type === "addons" ? kind.extras : dish.extras,
    sel.extras,
  );

  switch (kind.type) {
    case "simple":
      return kind.priceQar + extras;
    case "spicy-toggle":
      return (sel.spicy ? kind.spicyQar : kind.mildQar) + extras;
    case "sauce-price": {
      const sauce = kind.sauces.find((s) => s.id === sel.sauce) ?? kind.sauces[0];
      return (sauce?.priceQar ?? 0) + extras;
    }
    case "roll": {
      const protein =
        kind.proteins.find((p) => p.id === sel.protein) ?? kind.proteins[0];
      const pieces = (sel.pieces ?? preferredPieces(protein.prices)) as PieceCount;
      const base = protein.prices[pieces];
      if (base == null) {
        const fallback = preferredPieces(protein.prices);
        return (protein.prices[fallback] ?? 0) + extras;
      }
      return base + extras;
    }
    case "deal-box":
    case "party-box":
      return kind.priceQar + extras;
    case "size-price": {
      const size = kind.sizes.find((s) => s.id === sel.size) ?? kind.sizes[0];
      return (size?.priceQar ?? 0) + extras;
    }
    case "addons":
      return kind.priceQar + extras;
  }
}

export function hasPriceRange(dish: Dish): boolean {
  const kind = dish.kind;
  switch (kind.type) {
    case "simple":
    case "deal-box":
    case "party-box":
      return Boolean(dish.extras?.length);
    case "spicy-toggle":
      return kind.mildQar !== kind.spicyQar;
    case "sauce-price":
      return new Set(kind.sauces.map((s) => s.priceQar)).size > 1;
    case "roll":
      return true;
    case "size-price":
      return new Set(kind.sizes.map((s) => s.priceQar)).size > 1;
    case "addons":
      return true;
  }
}

export function selectionLabel(dish: Dish, sel: Selection, lang: Lang, t:Copy): string {
  const bits: string[] = [];
  const kind = dish.kind;

  if (kind.type === "roll") {
    const protein = kind.proteins.find((p) => p.id === sel.protein);
    if (protein && kind.proteins.length > 1) bits.push(pickName(protein, lang));
    if (sel.pieces) bits.push(`${sel.pieces} ${t.pcs}`);
    const topping = kind.topping?.options.find((o) => o.id === sel.topping);
    if (topping && topping.id !== "none") bits.push(pickName(topping, lang));
    const style = kind.style?.options.find((o) => o.id === sel.style);
    if (style) bits.push(pickName(style, lang));
  }

  if (kind.type === "sauce-price") {
    const sauce = kind.sauces.find((s) => s.id === sel.sauce);
    if (sauce) bits.push(pickName(sauce, lang));
  }

  if (kind.type === "spicy-toggle") {
    bits.push(sel.spicy ? t.spicy : t.regular);
  }

  if (kind.type === "size-price") {
    const flavor = kind.flavors?.options.find((o) => o.id === sel.flavor);
    if (flavor) bits.push(pickName(flavor, lang));
    const size = kind.sizes.find((s) => s.id === sel.size);
    if (size) bits.push(pickName(size, lang));
  }

  if (kind.type === "deal-box") {
    const st = kind.starters.find((o) => o.id === sel.starter);
    const su = kind.sushi.find((o) => o.id === sel.sushi);
    if (st) bits.push(pickName(st, lang));
    if (su) bits.push(pickName(su, lang));
  }

  if (kind.type === "party-box" && sel.starters?.length) {
    const names = countedChoiceNames(sel.starters, kind.starters, lang);
    if (names) bits.push(names);
  }

  if (kind.type === "addons") {
    if (kind.spicyOptional) bits.push(sel.spicy ? t.spicy : t.regular);
    if (kind.includedPicks && sel.picks?.length) {
      const names = countedChoiceNames(sel.picks, kind.includedPicks.options, lang);
      if (names) bits.push(names);
    }
    kind.freeChoices?.forEach((g) => {
      const id =
        g.id === "cut"
          ? sel.cut
          : g.id === "topping"
            ? sel.topping
            : g.id === "style"
              ? sel.style
              : g.id === "dip"
                ? sel.dip
                : undefined;
      const opt = g.options.find((o) => o.id === id);
      if (opt) bits.push(pickName(opt, lang));
    });
  }

  if (sel.dip) {
    const dip = dish.freeDips?.find((d) => d.id === sel.dip);
    if (dip) bits.push(`${t.dip}: ${pickName(dip, lang)}`);
  }

  const extraList = kind.type === "addons" ? kind.extras : dish.extras;
  if (sel.extras?.length && extraList) {
    const names = sel.extras
      .map((id) => extraList.find((e) => e.id === id))
      .filter((extra): extra is Extra => Boolean(extra))
      .map((extra) => pickName(extra, lang));
    if (names.length) bits.push(names.join(lang === "ar" ? "، " : ", "));
  }

  return bits.join(" · ");
}

/** Whose photo is shown: the chosen roll style's or protein's, else the dish's own. */
function photoOf(dish: Dish, sel: Selection): { image: string; optionsImage?: string } {
  if (dish.kind.type === "roll") {
    const style = dish.kind.style?.options.find((o) => o.id === sel.style);
    const protein = dish.kind.proteins.find((p) => p.id === sel.protein);
    for (const o of [style, protein])
      if (o?.image) return { image: o.image, optionsImage: o.optionsImage };
  }
  return dish;
}

/** The card photo (9:16 where one exists). */
export function imageFor(dish: Dish, sel: Selection): string {
  return photoOf(dish, sel).image;
}

/** The options-sheet and viewer photo: the full original or an uploaded options photo, else the card photo. */
export function sheetImageFor(dish: Dish, sel: Selection): string {
  const photo = photoOf(dish, sel);
  return photo.optionsImage ?? photo.image;
}

/** object-position for a photo: the dish's focal point applies to its own card photo only. */
export function photoPosition(dish: Dish, photo: string): string | undefined {
  const f = dish.imageFocus;
  return f && photo === dish.image ? `${f.x}% ${f.y}%` : undefined;
}

export function isSelectionComplete(dish: Dish, sel: Selection): boolean {
  const kind = dish.kind;
  // A saved selection may name options the CMS has since removed.
  const has = (options: { id: string }[] | undefined, id: string | undefined) =>
    !id || Boolean(options?.some((o) => o.id === id));
  const extras = kind.type === "addons" ? kind.extras : dish.extras;
  if (sel.extras?.some((id) => !has(extras, id))) return false;
  const dipOption =
    kind.type === "addons" && kind.freeChoices?.some((g) => g.id === "dip" && has(g.options, sel.dip));
  if (!has(dish.freeDips, sel.dip) && !dipOption) return false;
  if (kind.type === "sauce-price" && !has(kind.sauces, sel.sauce)) return false;
  if (kind.type === "deal-box" && (!has(kind.starters, sel.starter) || !has(kind.sushi, sel.sushi))) return false;
  if (kind.type === "party-box" && sel.starters?.some((id) => !has(kind.starters, id))) return false;
  if (kind.type === "size-price" && (!has(kind.sizes, sel.size) || !has(kind.flavors?.options, sel.flavor))) return false;
  if (kind.type === "roll" && (!has(kind.topping?.options, sel.topping) || !has(kind.style?.options, sel.style))) return false;
  if (
    kind.type === "addons" &&
    kind.freeChoices?.some((g) => !has(g.options, sel[g.id as "cut" | "style" | "topping" | "dip"]))
  )
    return false;
  if (kind.type === "sauce-price" && !sel.sauce) return false;
  if (kind.type === "roll") {
    if (!sel.protein || !sel.pieces) return false;
    const protein = kind.proteins.find((p) => p.id === sel.protein);
    if (!protein || protein.prices[sel.pieces] == null) return false;
  }
  if (kind.type === "deal-box" && (!sel.starter || !sel.sushi)) return false;
  if (kind.type === "party-box") {
    const n = sel.starters?.length ?? 0;
    if (n < kind.starterMin || n > kind.starterMax) return false;
  }
  if (kind.type === "size-price") {
    if (!sel.size) return false;
    if (kind.flavors && !sel.flavor) return false;
  }
  if (kind.type === "addons" && kind.includedPicks) {
    const ids = sel.picks ?? [];
    const allowed = new Set(kind.includedPicks.options.map((option) => option.id));
    if (ids.some((id) => !allowed.has(id))) return false;
    if (ids.length < kind.includedPicks.min || ids.length > kind.includedPicks.max) return false;
  }
  if (dish.freeDips?.length && !sel.dip) return false;
  return true;
}

export function serializeSelection(sel: Selection): string {
  const parts: string[] = [];
  if (sel.protein) parts.push(`p:${sel.protein}`);
  if (sel.pieces) parts.push(`n:${sel.pieces}`);
  if (sel.sauce) parts.push(`s:${sel.sauce}`);
  if (sel.spicy) parts.push("spicy");
  if (sel.size) parts.push(`sz:${sel.size}`);
  if (sel.flavor) parts.push(`f:${sel.flavor}`);
  if (sel.starter) parts.push(`st:${sel.starter}`);
  if (sel.sushi) parts.push(`su:${sel.sushi}`);
  if (sel.starters?.length) parts.push(`sts:${[...sel.starters].sort().join(",")}`);
  if (sel.extras?.length) parts.push(`x:${[...sel.extras].sort().join(",")}`);
  if (sel.picks?.length) parts.push(`pk:${[...sel.picks].sort().join(",")}`);
  if (sel.topping) parts.push(`t:${sel.topping}`);
  if (sel.style) parts.push(`styl:${sel.style}`);
  if (sel.cut) parts.push(`c:${sel.cut}`);
  if (sel.dip) parts.push(`d:${sel.dip}`);
  return parts.join("|");
}

export function parseSelection(raw: string): Selection {
  const sel: Selection = {};
  if (!raw) return sel;
  for (const part of raw.split("|")) {
    if (part === "spicy") sel.spicy = true;
    else if (part.startsWith("p:")) sel.protein = part.slice(2);
    else if (part.startsWith("n:")) sel.pieces = Number(part.slice(2)) as PieceCount;
    else if (part.startsWith("s:")) sel.sauce = part.slice(2);
    else if (part.startsWith("sz:")) sel.size = part.slice(3);
    else if (part.startsWith("f:")) sel.flavor = part.slice(2);
    else if (part.startsWith("st:")) sel.starter = part.slice(3);
    else if (part.startsWith("su:")) sel.sushi = part.slice(3);
    else if (part.startsWith("sts:")) sel.starters = part.slice(4).split(",").filter(Boolean);
    else if (part.startsWith("x:")) sel.extras = part.slice(2).split(",").filter(Boolean);
    else if (part.startsWith("pk:")) sel.picks = part.slice(3).split(",").filter(Boolean);
    else if (part.startsWith("t:")) sel.topping = part.slice(2);
    else if (part.startsWith("styl:")) sel.style = part.slice(5);
    else if (part.startsWith("c:")) sel.cut = part.slice(2);
    else if (part.startsWith("d:")) sel.dip = part.slice(2);
  }
  return sel;
}

export function dishIsVeg(dish: Dish, sel?: Selection): boolean {
  if (dish.kind.type === "roll" && sel?.protein) {
    const protein = dish.kind.proteins.find((p) => p.id === sel.protein);
    if (protein) return Boolean(protein.veg);
  }
  return dish.tags.includes("veg");
}

export function dishIsSpicy(dish: Dish, sel?: Selection): boolean {
  if (sel?.spicy) return true;
  if (dish.kind.type === "sauce-price" && sel?.sauce) {
    return Boolean(dish.kind.sauces.find((s) => s.id === sel.sauce)?.spicy);
  }
  if (dish.kind.type === "roll" && sel?.protein) {
    const protein = dish.kind.proteins.find((p) => p.id === sel.protein);
    if (protein?.spicy) return true;
  }
  return dish.tags.includes("spicy");
}

export function dishIsSeafood(dish: Dish, sel?: Selection): boolean {
  if (dish.kind.type === "roll" && sel?.protein) {
    const protein = dish.kind.proteins.find((p) => p.id === sel.protein);
    if (protein) return Boolean(protein.seafood);
  }
  return dish.tags.includes("seafood");
}
