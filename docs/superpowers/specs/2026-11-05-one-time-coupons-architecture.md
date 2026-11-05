# Coupons architecture sketch

## Domain shape

Status state machine (not booleans):

```
available --claim(orderId)--> held --redeem--> redeemed
held --release--> available
available --disable--> disabled
```

Illegal: claim from held/redeemed/disabled; redeem unless held by that order; release unless held by that order.

## Module map

| Module | Owns |
| --- | --- |
| `src/ordering/coupons/code.ts` | normalize + generate |
| `src/ordering/coupons/discount.ts` | pure `applyOrderDiscount(subtotalMinor, {kind,value})` |
| `src/ordering/coupons/repository.ts` | SQL create/list/disable/preview/claim/redeem/release + stale hold release |
| `src/ordering/coupons/types.ts` | Coupon row + snapshot coupon blob |
| Checkout `quoteOrder` | calls discount after lines; optional code |
| `settlePayment` | redeem after successful paid write |
| Order cancel | release |
| Admin API + CouponsPanel | CRUD UI |
| OrderDetail + receipt | read snapshot.coupon |

## Snapshot coupon blob

```ts
{ code: string; kind: 'percent' | 'amount'; value: number; discountMinor: number }
```

`orders.total_minor` remains payable. Line totals stay pre-discount; discount is order-level (same pattern as staff `discountMinor = sum(lines) - total_minor`).

## Integration invariants

- Claim inside `persistPendingOrder`'s write transaction (same batch as the order insert).
- Idempotent checkout replay must not re-claim.
- Burn in `settlePayment`'s successful batch (online) and in pay-at-pickup `counterSettlementStatements` when recording payment.
- Do not treat the 30-minute customer `expired` label as a release signal; late Sadad can still settle a `placed` row.
- Kitchen/ticket need `snapshot.coupon`; line unit prices stay menu price; payable is `orders.total_minor`.

## Synthesis decision

Chose a dedicated coupons table + domain module over stuffing codes into menu JSON. Lifecycle and race-safe claim need real rows and conditional updates; staff CRUD is the template. Deferred `scope` column keeps product discounts out of v1 call sites.
