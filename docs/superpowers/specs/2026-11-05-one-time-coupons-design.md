# One-time whole-order coupons (v1)

## Goal

Admins create single-use coupon codes (percent or fixed QAR off the whole order). Customers apply a code on the review step before Sadad. Kitchen sees that a coupon discount was applied. Product/category scope is deferred.

## Who

- Create / list / disable: CMS `admin` only (same gate as Users/Settings). There is no separate super-admin role.
- Apply: anonymous customer session at checkout review.
- See discount: kitchen order detail, customer receipt, order snapshot.

## Coupon model

| Field | Rule |
| --- | --- |
| `code` | Unique, case-insensitive; stored uppercase. Admin types it, or Generate. |
| Generated form | 8 chars from unambiguous alphabet (no `0O1IL`), shown as `XXXX-XXXX`. |
| `kind` | `percent` or `amount`. |
| `value` | Percent: integer 1–99. Amount: positive QAR stored as minor units. |
| `expires_at` | Required. Invalid at/after this instant. |
| Lifecycle | `available` → `held` (pending order) → `redeemed` (paid), or `held` → `available` on release. Unused codes may be `disabled`. |

## Discount rules (v1)

- Whole order only. One code per order. No stacking.
- Preview/validate does not consume.
- Reject if expired, disabled, held by another order, redeemed, or unknown.
- Reject if discount would leave payable total ≤ 0 (fixed larger than cart, or 100%). No free-order / skip-Sadad path in v1.
- Authoritative quote happens in `quoteOrder` so `orders.total_minor` and Sadad match.

## Redemption (industry pattern)

1. Customer applies on review → validate + show new total (no burn).
2. `POST /api/orders` with code → re-validate, claim atomically (`available` → `held` for this order id), persist discounted snapshot.
3. Sadad settle / paid → burn (`held` → `redeemed`).
4. Order cancelled, or hold TTL exceeded without paid → release (`held` → `available`) if still held by that order.

Claim uses a conditional SQL update so two checkouts cannot both hold the same code.

## Kitchen / receipt

Order snapshot stores coupon metadata (`code`, `kind`, `value`, `discountMinor`). Kitchen order detail shows subtotal, coupon line with code and amount, then payable total. Customer receipt shows the same discount line.

## Out of scope (later)

- Per-product / category scope.
- Free (0 QAR) checkout.
- Batch generate, multi-use, per-user limits, stacking, min-order separate from “must leave > 0 payable”.

## Extensibility

Table may later add a `scope` column (`order` default). Redemption and quote stay behind one coupon domain module so callers do not grow product-specific branches in v1.
