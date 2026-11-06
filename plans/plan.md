# Implementation Plan

## Reference

- Requirements: `plans/requirements.md`
- Architecture: `plans/architecture.md`
- Design base: `/tmp/arena-compare-at/candidate-1/design.md`

## Steps

### 1. Cent rule + schema keys

- **What**: Add `src/cms/compare-at.ts` with `compareAtIsHigher`. Extend `src/cms/schema.ts` with optional compare-at siblings via a `priced()` helper. Roll protein gets optional `compareAtQar` record refined against `prices` keys.
- **Files**: `src/cms/compare-at.ts`, `src/cms/schema.ts`, `tests/menu.test.ts` (or new focused test)
- **Validate**: Existing menu still parses. Compare-at equal or lower than charge fails. Roll compare-at on a missing portion fails. Unknown key still fails `.strict()`.
- **Depends on**: none

### 2. Display helpers beside `unitPrice`

- **What**: Refactor charge walk so `unitPrice` and `shownPrice` share one unexported leaf walk. Export `ShownPrice` with `chargeQar` and `wasQar` (derived strike, never stored). Export `shownPrice`, `shownLeaf`. Keep every money caller on `unitPrice`.
- **Files**: `src/ordering/price.ts`, tests asserting `shownPrice.chargeQar === unitPrice(...)` and that compare-at does not change charge
- **Validate**: Existing price/checkout tests pass. New fixture with base+extra sale folds list correctly.
- **Depends on**: 1

### 3. Admin compare-at inputs

- **What**: `chargePair` in `OptionsEditor` for base, heat, sauce, size, extras. Label the compare field "Was price". Helper text that customers see it crossed out, pay the price, and that coupons stay a separate checkout discount. Portion grid compare-at under each count. Blank deletes key. Never default compare-at to `0`.
- **Files**: `src/components/admin/OptionsEditor.tsx` (and only what it already wires through `ItemEditor`)
- **Validate**: Manual save of a simple dish with compare-at. Manual blank clears key. Invalid compare-at surfaces field error on that path.
- **Depends on**: 1

### 4. Customer `PriceShown`

- **What**: New `PriceShown` component reading `ShownPrice.wasQar`. "from" prefixes the charge only. Wire `DishSlide`, `MenuFeed` search row, `DishDetailSheet` unit price and priced option/extra rows. Migrate `ChoiceRow` from string `hint` to `price?: ShownPrice` in the same change. No new required copy keys.
- **Files**: `src/components/menu/PriceShown.tsx`, `DishSlide.tsx`, `MenuFeed.tsx`, `DishDetailSheet.tsx`, CSS for `.price-was`
- **Validate**: Card and detail show strike when set. Cart and add button stay charge-only. VoiceOver-style check of aria-label / sr-only Was-Now.
- **Depends on**: 2, 3

### 5. Checkout and coupon regression

- **What**: Extend checkout/coupon test so a dish with compare-at quotes the same `totalMinor` and coupon `discountMinor` as charge-only.
- **Files**: `tests/checkout.test.ts` (or sibling)
- **Validate**: Test fails if `unitPrice` or quote reads compare-at.
- **Depends on**: 2

### 6. Docs

- **What**: Short note in an existing engineering or CMS doc if one already describes menu pricing. Otherwise a brief comment in `docs/` only if the team already documents menu schema there. Prefer updating an existing file over a new one.
- **Files**: existing docs that mention menu price fields, if any
- **Validate**: Doc matches shipped keys and "charge vs compare-at" rule.
- **Depends on**: 4, 5

## Out of scope

- [ ] Dish-level-only compare-at (candidate 2)
- [ ] Strike in cart, ticket, kitchen
- [ ] Sale windows, badges, percent-off
- [ ] Production / `main`
- [ ] Required copy-schema keys for Was/Now

## Notes for the verifier

- [ ] Hardest check: charge path and coupon math ignore compare-at
- [ ] Hardest UX check: roll portion and sauce rows each strike their own leaf, not a shared dish was-price
- [ ] Hardest a11y check: meaning is not color-only. Spoken order includes Was then Now
- [ ] Confirm invalid compare-at blocks save with a visible field error before publish
