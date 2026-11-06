# Architecture

## Context

Today every chargeable amount is a bare QAR number on the dish `kind` (and paid extras). `unitPrice` in `src/ordering/price.ts` is the single payable resolver for cards, detail, cart, checkout, and staff edits. Coupons discount the order subtotal after those line charges. There is no compare-at field.

This change adds an optional compare-at sibling on every chargeable leaf (Shopify variant style). Display helpers derive a `ShownPrice`. Charge math does not change. Arena candidate 1 is the base. Candidate 2 (dish-level was-price) is rejected for multi-variant honesty. Grafts from candidate 2 are listed under Alternatives.

Explore map: [Map menu pricing surfaces](4510c916-00a0-4fc4-9561-9cac7d8acbed).  
Design packages: `/tmp/arena-compare-at/candidate-1/design.md`, `/tmp/arena-compare-at/candidate-2/design.md`.

## Components

- **`src/cms/compare-at.ts`** — `compareAtIsHigher(compareAt, charge)`. Shared cent rule for Zod and display
- **`src/cms/schema.ts`** — optional compare-at keys on priced objects. `priced()` helper with `superRefine`. Roll protein sibling `compareAtQar` record keyed by portion
- **`src/ordering/price.ts`** — keep `unitPrice` as charge. Add unexported `quoteLeaves`, public `shownPrice`, `shownLeaf`, `ShownPrice`
- **`src/components/menu/PriceShown.tsx`** — sole strikethrough markup (`<s>` + `.price-was`, sr-only Was/Now)
- **`DishSlide` / `MenuFeed` / `DishDetailSheet`** — render `PriceShown`. Option rows pass `ShownPrice` instead of string hints
- **`OptionsEditor`** — `chargePair` fields (Price + Compare-at). Portion grid gets a compare-at under each count
- **Untouched on purpose** — cart, checkout quote, coupons, tickets, kitchen, Sadad. They keep calling `unitPrice`

## Data

No SQL. Menu JSON only.

| Object | Charge key | Compare-at key |
| --- | --- | --- |
| simple, deal-box, party-box, addons, sauce, size/extra | `priceQar` | `compareAtQar` |
| spicy-toggle | `mildQar` / `spicyQar` | `mildCompareAtQar` / `spicyCompareAtQar` |
| roll protein | `prices[n]` | `compareAtQar[n]` (optional record; keys must exist in `prices`) |

Invariants:

- Compare-at absent means no strike
- When present, compare-at must be at least one cent above its charge or the menu parse fails
- `schemaVersion` stays `1`
- Blank admin input deletes the key (does not store `0` or `null`)

## Interfaces

```ts
export type ShownPrice = {
  chargeQar: number;
  /** Derived strike for this selection. Never written back to the menu. */
  wasQar: number | null;
};

export function unitPrice(dish: Dish, sel: Selection): number;
export function shownPrice(dish: Dish, sel: Selection): ShownPrice;
export function shownLeaf(chargeQar: number, compareAtQar?: number): ShownPrice;
export function compareAtIsHigher(compareAt: number, charge: number): boolean;
```

Stored JSON still uses `compareAtQar` (and heat/portion siblings) on each leaf. The display object names the summed strike `wasQar` so callers cannot confuse it with a stored field.

`shownPrice.chargeQar` must equal `unitPrice` for the same inputs. Money code imports `unitPrice` only. The word "from" prefixes the payable charge only, never the struck amount.

Cross-judge ([Cross-judge compare-at designs](f8a88745-4e26-4c00-b758-4239a787cc7e)): candidate 1 wins 26–22. No hard veto.

## Security

Admin-only menu write path unchanged. Customer menu is already public JSON. Compare-at is not a secret. No new auth surface.

## Accessibility

- Strikethrough uses `<s>` plus CSS line-through (not color alone)
- Screen readers get sr-only "Was" / "Now" (and Arabic) around the two amounts
- Card `aria-label` includes the spoken phrase when a strike is present
- Detail unit price keeps `aria-live="polite"`

## Performance

Not material. One extra reduce beside existing `unitPrice` walks on menu surfaces only.

## Alternatives considered

- [ ] **Dish-level `compareAtQar` only (candidate 2)** — one CMS field, tiny blast radius. Rejected as base (cross-judge multi-variant score 2/5). A single was-price cannot honestly describe different sauce/size/portion sales. Grafts taken: display strike named `wasQar`; "from" bound to charge only; admin labels "Was price" plus hint that coupons stay a checkout discount. Left out: `maxBaseCharge` ceiling, required `wasPrice` copy key (breaks `CMS_PUBLIC_MENU_SOURCE_URL` parse, which skips `normalizeStoredMenu`)
- [ ] **Nested `{ priceQar, compareAtQar }` on every amount** — cleaner leaf if greenfield. Rejected. Forces every charge reader and roll `prices[n]` to change, and needs a normalizer before parse while `schemaVersion` stays 1
- [ ] **Percent-off on the dish** — looks like a coupon and cannot express an arbitrary list price. Rejected

## Risks

- [ ] After the first saved compare-at key, rolling the app back to a build that does not know the key fails `.strict()` parse — mitigate by shipping schema+read before staff rely on the fields, and by documenting that rollback needs those keys cleared
- [ ] Admin portion grid grows denser — mitigate with clear "Compare-at" labels and blank-means-off
- [ ] Guests might read "from" + strike as "old minimum" — "from" meaning stays unchanged in this change. Fix "from" semantics only if product asks

## Open questions

- [ ] Spoken Arabic Was/Now strings (see requirements)
