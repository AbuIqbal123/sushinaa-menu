import table from "../../data/card-photos.json";
import type { MenuData } from "./schema";

const cards: Record<string, string> = table.cards;
const focus: Record<string, { x: number; y: number }> = table.focus;

type Photo = { image?: string; optionsImage?: string };

/**
 * Uses the approved portraits for untouched seeded photos, retaining full originals.
 * Existing seeded crops are upgraded only when their full-photo pairing is unchanged.
 * Custom CMS images/options photos are preserved. Repeated reads are idempotent.
 */
export function withCardPhotos(input: MenuData): {
  menu: MenuData;
  changed: string[];
} {
  const menu = structuredClone(input);
  const changed = new Set<string>();
  for (const dish of menu.dishes) {
    const photos: Photo[] = [dish];
    if (dish.kind.type === "roll")
      photos.push(...dish.kind.proteins, ...(dish.kind.style?.options ?? []));
    for (const photo of photos) {
      const original = photo.optionsImage ?? photo.image;
      const card = original && cards[original];
      if (!card) continue;
      const untouchedOriginal = photo.image === original && !photo.optionsImage;
      const untouchedCrop = photo.optionsImage === original
        && photo.image === card.replace("/portrait/", "/card/");
      if (!untouchedOriginal && !untouchedCrop) continue;
      photo.optionsImage = original;
      photo.image = card;
      changed.add(dish.id);
    }
    if (!dish.imageFocus && focus[dish.image]) {
      dish.imageFocus = focus[dish.image];
      changed.add(dish.id);
    }
  }
  return { menu, changed: [...changed] };
}
