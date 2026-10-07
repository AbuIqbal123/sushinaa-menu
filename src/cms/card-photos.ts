import table from "../../data/card-photos.json";
import type { MenuData } from "./schema";

const cards: Record<string, string> = table.cards;
const focus: Record<string, { x: number; y: number }> = table.focus;

type Photo = { image?: string; optionsImage?: string };

/**
 * Moves seeded photos onto their approved 9:16 card crops, keeping the
 * original as the full photo, and gives originals without a crop the focal
 * point of their best crop. Only values that still equal the seeded original
 * change, so admin edits are left alone and a second run changes nothing.
 * Returns the ids of the dishes it changed.
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
      const card = photo.image && cards[photo.image];
      if (!card || photo.optionsImage) continue;
      photo.optionsImage = photo.image;
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
