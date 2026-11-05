# One-time coupons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship admin-created one-time whole-order coupons (percent or fixed QAR), customer apply on review, kitchen-visible discount, claim/burn/release lifecycle.

**Architecture:** Coupons own a table + domain module (`src/ordering/coupons/`) with a status state machine. Checkout quotes through that module; CMS admin CRUD mirrors staff; kitchen reads coupon from the order snapshot.

**Tech Stack:** Next.js App Router, Turso/SQLite, zod, existing checkout/`quoteOrder`/Sadad settle paths.

## Global Constraints

- PRs target `dev` only. Never push or migrate production/`main`.
- No em dashes in user-facing copy.
- Discount that would leave ≤ 0 QAR is rejected.
- Generated codes: 8 unambiguous chars, display `XXXX-XXXX`.
- Expiration required at create.

---

### Task 1: Schema + coupon domain + pure quote math

**Files:**
- Create: `db/migrations/0009_coupons.sql`
- Create: `src/ordering/coupons/` (types, normalize/generate, applyDiscount, repository claim/release/redeem, admin CRUD)
- Modify: `src/ordering/schema.ts`, `src/cms/db.ts` bootstrap
- Modify: `tests/copy-and-migrate.test.ts`, `tests/order-bootstrap.test.ts`
- Test: `tests/coupons.test.ts`

**Interfaces:**
- Produces: `normalizeCode`, `generateCode`, `applyOrderDiscount`, `previewCoupon`, `claimCoupon`, `redeemCouponForOrder`, `releaseCouponForOrder`, `createCoupon`, `listCoupons`, `disableCoupon`

- [ ] Migration `coupons` table + bootstrap copy
- [ ] Pure discount math tests (percent, amount, reject ≤0, expired)
- [ ] Claim/redeem/release tests on file DB
- [ ] Expect migration id `0009` in migrate suite

### Task 2: Wire checkout quote + settle/cancel

**Files:**
- Modify: `src/ordering/checkout/validation.ts` (`checkoutSchema` + `quoteOrder`)
- Modify: `src/ordering/checkout/repository.ts` (`persistPendingOrder` same write txn as claim)
- Modify: `src/ordering/payments.ts` `settlePayment` batch (redeem, gated like outbox)
- Modify: `src/ordering/orders.ts` `counterSettlementStatements` / `transitionOrder` (pay-at-pickup burn; cancel release)
- Modify: customer contracts / receipt discount fields
- Test: extend checkout/order tests

**Grounding (from how):**
- Coupon code must be on `checkoutSchema` (strict) and in the idempotency hash.
- Idempotent replay (`reused: true`) must not claim again; hold already exists for that order.
- Claim inside `persistPendingOrder` write transaction, not after commit.
- Do not release on the 30-minute customer `expired` label; late Sadad can still settle. Release on cancel, disable, or admin void; optional stale-hold TTL only with a long window that still allows late webhooks, or only when reclaiming for a *new* order after the prior order was cancelled.
- Online burn only when `settlePayment` returns success / in that batch. Pay-at-pickup burn with `counterSettlementStatements` when `recordPayment` completes.
- Lines stay full menu price; lower `snapshot.totalMinor` / `orders.total_minor` only. Receipt already derives `discountMinor` from the gap; kitchen and ticket need an explicit coupon line from `snapshot.coupon`.

- [ ] Optional `couponCode` on checkout
- [ ] Snapshot includes `coupon` + discounted `totalMinor`
- [ ] Claim in same txn as persist; redeem on settle + counter pay; release on cancel
- [ ] Stale hold: release only when safe (see grounding); never at minute-30 alone

### Task 3: Customer review UI

**Files:**
- Modify: `src/components/checkout/OrderingExperience.tsx`
- Optional: small coupon field component under checkout/
- CSS as needed in existing checkout styles

- [ ] Code field + Apply on review
- [ ] Show discount + new total; clear errors
- [ ] Pass code into checkout POST

### Task 4: CMS Coupons panel

**Files:**
- Create: `src/app/api/admin/coupons/route.ts` (+ `[id]` disable)
- Create: `src/components/admin/CouponsPanel.tsx`
- Modify: `src/components/admin/Admin.tsx` nav
- Test: admin API tests as needed

- [ ] Admin-only list/create/disable
- [ ] Manual code + Generate button
- [ ] Required expiration, kind, value

### Task 5: Kitchen + receipt visibility

**Files:**
- Modify: `src/components/admin/OrderDetail.tsx`
- Modify: customer receipt path in OrderingExperience / contracts
- Modify: `src/ordering/orders.ts` detail payload if needed

- [ ] Kitchen shows subtotal, coupon code + discount, payable total
- [ ] Customer receipt shows coupon discount line

### Task 6: Verify + PR to dev

- [ ] `npm test` green
- [ ] Branch off `dev`, commits in task order
- [ ] PR into `dev` (not `main`)
