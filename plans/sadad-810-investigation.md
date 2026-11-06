# Why Sadad returned 810

Sadad declined one sandbox card payment and later accepted three others. Our checkout sent the same form shape both times. The 12:29 failure is a signed gateway result, `RESPCODE` 810 and `Txn Failed`. It is not a sale-price total, a coupon-field bug, a decimal-format bug, or an env change between the two deploys. Only the Sadad panel can say why that one transaction was declined.

## What changed between the deploys

test-dev on branch `dev`, project `prj_bLv7qTemvrHFfTPBKhdBsvEyHW3V`. All three deploys below are preview, `target` null, alias `test-dev-abu-iqbal-projects.vercel.app`. Measured from Vercel deployment records.

| Deploy | Ready UTC | Commit | What it shipped |
| --- | --- | --- | --- |
| `dpl_7f261XTUbi9rZEevNnyVkMerSvNh` | 2026-11-06 11:12 | `36292c0` #77 | Fail notice after repeated Sadad returns. Already includes #75 and #76. |
| `dpl_CkLD5s2NfYerr1KsaqgrJLisn1QM` | 2026-11-06 12:20 | `124150c` #78 | Sale price on the menu, and order resume stored per branch. This is the fail deploy. |
| `dpl_G15Uq5F5Lof4R5GFPcX8CyKAnjWW` | 2026-11-06 13:09 | `35cbc9b` #79 | Resume pay only when the live basket still matches. A new place cancels stale unpaid online rows and frees their held coupons. Stronger fail notice. This is the success deploy. |

`git diff 36292c0 35cbc9b` is empty for `src/ordering/vendors/sadad`, `begin-payment.ts`, `quote.ts`, `payments.ts`, and `src/ordering/coupons`. The bytes that build `TXN_AMOUNT`, the signature, `productdetail`, coupon claim, and coupon redeem did not change between the deploy that was live before the fail and the deploy that took the later successes.

#75 through #77 were already in the fail binary. They change the return URL, the admin Release action, callback log fields, and the customer fail notice. They do not change the form posted to `https://sadadqa.com/webpurchase`.

#78 changes `unitPrice` so a lower `saleQar` is what the guest pays, and it scopes the stored order id to the branch. It does not touch Sadad.

#79 does not touch Sadad either. It can only change which order a later click pays, and it can free a coupon that an earlier unpaid order still holds. The three successes are new order ids with their own `checkout.launch` lines. They are not a replay of `SU-ce035104`.

## The failed pay and the later pays

Hobby runtime logs keep about one hour. A query from 09:50 UTC through 15:50 UTC for `SU-ce035104` returned HTTP 400, retention exceeded. The 12:29 lines are gone. The facts below for that order are the ones recorded in the parent chat while the log still existed, and they match the brief for this investigation.

Fail, on the #78 deploy.

- Order `SU-ce035104-2222-4891-bc05-02e8822bda68`.
- Launch 12:27:31 UTC. Callback 12:29:06 UTC.
- `amountMinor` 5670, which `formatMajorAmount` renders as `56.70`.
- Sadad `STATUS=TXN_FAILURE`, `RESPCODE=810`, `RESPMSG=Txn Failed`.
- Our log event was `callback.applied` with a failed return, not `callback.verify_failed`. The checksum matched. `applyVerifiedFact` then refused to set `paid_at` because the outcome was not paid.

An earlier launch the same morning, `SU-c38430fd`, `amountMinor` 5500 at 12:23, had no callback. That attempt never produced a Sadad result. The parent chat also described a 12:23 launch at 55.00 QAR whose id ended in `e1d47b5095a8`. Treat that as the same abandoned attempt unless the panel shows two orders.

Success, re-read this session from deployment `dpl_G15Uq5F5Lof4R5GFPcX8CyKAnjWW`.

| Order | Launch | Callback | amountMinor | Result |
| --- | --- | --- | --- | --- |
| `SU-08c55cb1-f012-47e1-875c-7f274f1b1683` | 15:33:19 | 15:34:10 | 9800 | `respCode` 1, `TXN_SUCCESS`, `Txn Success`, `settled` true |
| `SU-8ae6003e-489e-409d-a454-c9de7d5febb1` | 15:36:14 | 15:36:56 | 9810 | same, settled true |
| `SU-cebea2c3-2948-4b9e-9968-efe7ca56f9da` | 15:41:08 | 15:42:25 | 10830 | same, settled true |

Every success `checkout.launch` logged the same field names, in this order after sort.

`CALLBACK_URL`, `MOBILE_NO`, `ORDER_ID`, `SADAD_WEBCHECKOUT_PAGE_LANGUAGE`, `TXN_AMOUNT`, `VERSION`, `WEBSITE`, `merchant_id`, `productdetail[0][amount]`, `productdetail[0][order_id]`, `productdetail[0][quantity]`, `signature`, `txnDate`.

`website` and `callbackHost` were both `test-dev-abu-iqbal-projects.vercel.app`. The parent chat described that same name list for the 12:29 launch. A 10:10 UTC launch of `SU-af14d5b0` at `amountMinor` 5225, captured in the prior transcript from deploy `dpl_WCkNMnvGobHvb7YgaxHB3d6ARu1a` on pull request 74, used that same name list too.

Before sale price shipped, the same transcript records sandbox callbacks with `transaction_status` 2, meaning failed, at 10:03 and 10:12 UTC. Order `SU-52214836` was `amountMinor` 8280. Order `SU-af14d5b0` was `amountMinor` 5225. Those deploys are pull requests 73 and 74. Sadad was already returning failed on this project hours before #78.

## Sale price cannot explain 56.70

`quoteOrder` prices each line with `unitPrice`, then `previewCoupon` subtracts the order discount. `beginHostedCheckout` does not re-price. It reads `orders.total_minor` and sends that integer as both the transaction amount and the single product line.

```ts
line: {
  reference: orderId,
  amountMinor: Number(row.total_minor),
  quantity: 1,
}
```

`formatMajorAmount` is `(minor / 100).toFixed(2)` in `src/ordering/vendors/sadad/begin.ts`. That function last changed in `ec2b184`, when Sadad checkout was added. It is the same function on #77, #78, and #79. A local experiment that printed exact tenths as one decimal was reverted and was never deployed.

`unitPrice` after #78 charges `saleQar` only when `saleIsLower` says the sale is at least one cent under the list price. With no lower sale, the charge is the old `priceQar`. A burger at 63.00 QAR is 6300 minor. A 10 percent coupon uses half-up in `applyOrderDiscount`. `Math.floor((6300 * 10 + 50) / 100)` is 630. `6300 - 630` is 5670. Ran that expression this session. The launched total is the list price after 10 percent, not a sale price and not a float artifact.

Appendix A calls `productdetail[n][amount]` the unit price and `quantity` the ordered quantity, and it says `TXN_AMOUNT` should use up to two decimals, example `500.00`. Our form always sends one line whose amount equals the order total and whose quantity is 1, so amount times quantity equals `TXN_AMOUNT`. The signature string skips `productdetail`, so a bad product line could still verify. It does not separate these attempts. The fail and the three successes all used that one-line shape, and `98.10` and `108.30` were accepted with two decimals. `52.25` and `82.80` had already been declined the same way earlier, also with two decimals.

The coupon code is not a Sadad field. Sadad sees only the discounted total.

## Coupons on the fail and on the successes

Claim, hold, and redeem are the same functions on the fail deploy and the success deploy.

1. `previewCoupon` checks the code and returns the discounted total. The order is not written yet.
2. `persistPendingOrder` calls `claimCouponOn` in the same write as the order insert. Status becomes `held` for that order id.
3. `settlePayment` runs `redeemHeldCouponStatement` only after `paid_at` is set.
4. `applyVerifiedFact` on a non-paid outcome updates the attempt and returns. It does not redeem and it does not release.

The 12:29 order reached `checkout.launch` at 5670, so the hold had already succeeded. The callback was a failed fact, so redeem did not run. The code stayed held until something else released it.

#79 adds one release path the fail deploy did not have. Placing a new online order in the same session cancels other unpaid `sadad` or `mock` rows for that session and sets their held coupons back to `available`. That can explain how a later order was allowed to claim a code the failed order still held. It does not change the form Sadad scored. `SU-8ae6003e` redeemed because its callback was paid and `settlePayment` ran the same redeem statement the fail deploy already had.

The dev database rows were not read. The Turso token on this machine lists other projects, not `sushinaa-cms-dev`. Coupon status for `SU-ce035104` is inferred from the code path plus the launch, not from a `SELECT`.

## Environment did not change

Sadad preview variables scoped to git branch `dev` are `PAYMENT_PROVIDER`, `SADAD_PUBLIC_ORIGIN`, `SADAD_MERCHANT_ID`, and `SADAD_SECRET_KEY`. `filter_project_envs` shows each of them created and last updated at 2026-11-05 11:26:06 UTC. That is about 25 hours before the fail deploy was built. Production-target copies of those names were last updated on 4 or 5 Nov, also before both builds.

`loadSadadConfig` reads `process.env` when a launch starts. Both deploys are preview on branch `dev`, so they resolve the same branch override. No Sadad variable was edited between 12:20 and 15:42. Values were not decrypted for this check.

## Ranked causes

**Proven.** Sadad accepted the callback signature and told us the payment failed. We stored that and did not settle. The first wrong outcome is the gateway result, not our mapper and not the coupon redeem.

**Proven.** The outbound form builder, the two-decimal amount format, the one-line product detail, the website host, and the callback host are the same on the fail deploy and the success deploy. #79 did not fix a payment-protocol bug. The later accepts happened on unchanged Sadad code.

**Eliminated.** Decimal format. The discarded theory said sandbox rejects coupon tenths when they are sent as `56.70` rather than `56.7`. `formatMajorAmount` stayed `toFixed(2)` on every deploy that ran today. The later pays include `98.10` and `108.30`, and both settled. Earlier pays at `52.25` and `82.80` had already failed with `transaction_status` 2. Tenths with two decimals both fail and succeed. Another format tweak would be a third fix on a false premise.

**Eliminated.** #78 sale price or `quoteOrder` producing a total Sadad rejects while the signature still matches. 5670 is exactly 63.00 QAR after 10 percent. Product amount and `TXN_AMOUNT` are the same integer. Quantity is 1.

**Eliminated.** Coupon hold or redeem as the thing Sadad rejected. The code never goes to Sadad. The fail launched, so the hold was valid. Redeem runs only after paid, which is why the CMS shows a redeem on `SU-8ae6003e` and not on the 810 order.

**Eliminated.** Env or merchant config drift between these two deploys. The Sadad variables were last written on 5 Nov.

**Eliminated as the difference, still a spec gap.** We omit `EMAIL`. Appendix A lists it. Success launches omit it too, and Sadad still returned `Txn Success`. Missing email does not explain 810 versus 1.

**Only the Sadad panel can answer.** Why transaction `SU-ce035104` at 56.70 QAR received `RESPCODE` 810 and `Txn Failed`, while the three later transactions received `RESPCODE` 1. The local Sadad vault says `RESPCODE` 1 means success and any other code means failed. It does not define 810. The panel is where card, 3-D Secure, issuer, sandbox risk, or an explicit cancel would show up. We do not log the phone or the card, so we also cannot prove those were the same across attempts.

Do not change `formatMajorAmount`, product lines, or coupon settlement to chase this 810. Those paths already match on a declined pay and on paid pays.
