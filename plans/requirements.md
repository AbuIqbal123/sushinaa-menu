# Requirements

## Feature

Menu compare-at (sale) pricing

## Problem

Staff can only set one charge price per leaf. They cannot show an older list price struck through next to a lower sale price on the customer menu. Coupons already discount an order after line prices. They are the wrong tool for a catalog sale.

## Users

- CMS editors setting temporary or promotional menu prices
- Customers browsing cards, search, and the dish detail sheet
- Checkout and kitchen stay on the payable charge (not a second merchandising number)

## Goals

- [ ] Staff set base (list) price and an optional lower sale price on each chargeable leaf
- [ ] Customers see the base struck through and pay the sale when set, else the base
- [ ] `unitPrice`, cart, checkout, Sadad totals, and coupons use the payable amount only
- [ ] Existing menus without sale keep loading unchanged

## Non-goals

- [ ] Coupons, staff line discounts, or compliments as a substitute for catalog sale
- [ ] Strikethrough on cart, checkout ticket, kitchen ticket, or add-to-order total
- [ ] Sale schedules, badges, or percent-off fields on the dish
- [ ] Compare-at on free (unpriced) options
- [ ] Production menu edits or `main` deploy from this work

## Assumptions

- [ ] Industry model is Shopify-style. Charge is what you pay. Compare-at is optional merchandising and must be strictly higher
- [ ] Multi-variant dishes (sauce, size, heat, roll portions) need a compare-at per leaf, not one dish-wide was-price
- [ ] Paid extras are chargeable leaves and get compare-at in v1
- [ ] Spoken "Was" / "Now" (and Arabic equivalents) can be fixed in the price component for v1 so copy schema does not need a required key
- [ ] Admin field label is "Was price". Stored JSON key stays `compareAtQar` on each leaf. Display type uses `wasQar` for the derived strike

## Constraints

- [ ] Menu is one JSON document. `schemaVersion` stays `1`. Objects stay `.strict()`
- [ ] Optional keys only so old documents parse
- [ ] Ship via `dev` / test-dev. Do not touch production data
- [ ] No em dashes in customer-facing copy
- [ ] Coding principles in `docs/engineering/coding-principles.md`

## Success criteria

- [ ] A dish with compare-at shows strike on card, search row, detail unit price, and priced option rows
- [ ] The same dish quotes the same `unitMinor` and coupon discount as without compare-at fields present for charge math
- [ ] A compare-at that is not strictly higher than its charge fails menu save with a field error on that compare-at path
- [ ] A menu that omits every compare-at key still parses and displays as today
- [ ] One automated check proves charge path ignores compare-at. One proves invalid compare-at fails parse

## Open questions

- [ ] Confirm Arabic spoken words for strike (`Was`/`قبل`, `Now`/`الآن`) or replace before ship
- [ ] Confirm add-to-order button stays charge-only (recommended). Live unit price still strikes
