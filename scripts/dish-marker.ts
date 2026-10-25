/** Confirmed against the live public menu and data/initial-menu.json. */
export const CONFIRMED_DISH_ID = "sushinaa-burger";
export const CONFIRMED_NAME = "Sushinaa burger";
export const CONFIRMED_NAME_AR = "برجر سوشينا";

const patterns = [
  /dev[\s_-]*only/i,
  /\[\s*dev\s*\]/i,
  /\(\s*dev\s*\)/i,
  /^\s*dev\b/i,
  /\bdevelopment\b/i,
  /للتطوير/,
  /تطوير/,
];

export function hasDevMarker(value: string) {
  return patterns.some((pattern) => pattern.test(value));
}
