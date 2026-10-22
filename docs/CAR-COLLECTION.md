# Car collection — private Stage 2 preview

Branch: `feature/curbside-ordering`, based on `origin/main` at `4b860d1`.
The approved category design was already merged in main. No code was copied over newer main changes.

## What can be reviewed now

- `/` remains the view-only menu, with its original storage key and copy.
- `/order` starts with four branches, using their supplied Qatar hours (including the previous day's overnight period). Closed branches can be browsed; checkout is blocked and checked again on the server.
- Published CMS content drives the feed, images, options, availability and prices. The ordering route reads a fresh menu on server refresh. All branches share this menu because branch-specific stock is not currently modelled by the CMS.
- Ordering has its own basket. Notes and options distinguish lines. Editing a multi-serving line opens the existing per-serving configurator and replaces that line atomically, preserving other lines.
- Collection details remain in memory across in-flow back/edit/branch/language changes. The basket survives a page reload; personal collection details deliberately do not. Unavailable selections remain flagged until the customer explicitly removes them.
- Review shows the branch, vehicle, contact, individual notes, quantities and total. Arabic-Indic and Persian digits are accepted; leading plate zeroes are preserved. Mobile entry is Qatar mobile (+974), not OTP verification. Vehicle plates allow letters, spaces and hyphens as well as digits.
- The local handoff creates a persistent unpaid preview order. Identical concurrent/repeated requests from the same cookie session and idempotency key return the same order. A different payload under that key is rejected. This is request-retry protection; reloading and starting a new attempt is a new checkout.
- Sadad is **not connected**. The public draft now shows a clearly marked, client-only hosted-checkout simulation with a brief processing animation and demo confirmation. Its card details are static, non-interactive placeholders. It makes no external payment request, charges no money, creates no production order, and sends nothing to the kitchen. Other payment states await a real provider implementation and end-to-end tests.

## Local setup

Use Node, `npm install`, and a local CMS database containing a published menu. This workspace has a private SQLite backup of the existing local CMS database, including the published wording previously synced from the live menu. No production database was written. No seed fixture is used as a frontend fallback.

In `.env.local`:

```dotenv
CMS_DATABASE_URL=file:./data/menu.db
ORDER_DATABASE_URL=file:./data/orders.db
ORDERING_PREVIEW_ENABLED=true
```

Run `next dev --webpack --hostname 0.0.0.0 --port 3008`, with `SUSHINAA_PREVIEW_HOST` set to the computer's exact LAN IP for phone testing. Open `/order`. The phone must be on the same network. Do not use real customer details for preview testing.

A separate public Vercel draft can set `CMS_PUBLIC_MENU_SOURCE_URL=https://sushinaa-menu.vercel.app/api/menu` and `NEXT_PUBLIC_ORDERING_DEMO_MODE=true`. This fetches current published CMS content read-only (and proxies uploaded menu photos if any) without access to the production CMS database. The draft payment step is client-only and creates no order; its simulated confirmation reuses the review receipt layout. Its availability depends on the published menu API. `POST /api/orders` is disabled in production regardless of environment configuration. To release ordering later requires an explicit implementation change after payment and CMS integration testing. No migration touches the CMS database. The order database must be durable (remote libSQL, with its own token) before future hosting; Vercel cannot use local SQLite files.

## Server contract and persistence

`GET /api/orders` establishes an HttpOnly SameSite=Strict cookie for the preview session and returns payment availability. `POST /api/orders` requires same-origin JSON, an `Idempotency-Key`, and a body under 64 KiB:

```ts
{
  branchId: 'down-town' | 'al-thumama' | 'west-bay' | 'al-khor',
  customer: { name, phone, plate, colour, car, instructions },
  lines: [{ dishId, selection, quantity, note, expectedUnitMinor }]
}
```

Amounts are integer QAR minor units (100 = 1 QAR). `expectedUnitMinor` is only an optimistic check: the server calculates all prices from the current CMS record, validates selections against that dish, rejects removed/hidden/unavailable items, checks branch hours, and refuses changed prices. Client totals and extra properties are rejected. Limits are 20 servings per line, 100 per order and 10 new preview attempts per cookie session/hour; production also needs an infrastructure-backed abuse limiter, not just this cookie limit.

Orders store a versioned immutable JSON snapshot with menu revision, stable branch ID/name, collection method `car`, customer/vehicle details, dish IDs and bilingual names, the option catalogue at purchase time, selections, per-line notes, quantities and integer unit/line/grand totals in QAR. An order has an opaque UUID reference, session hash, request hash, creation and expiry timestamps, `payment_status` and a **separate** `fulfilment_status`. Preview drafts expire after 30 minutes; this is an internal draft lifetime, not a promised Sadad session lifetime. Expiry is checked on reuse. No public endpoint exposes customer records.

Tables prepared for the next phase:

- `orders`: snapshot plus independent payment/fulfilment states, initially `awaiting_payment` / `not_submitted`.
- `payment_attempts`: attempt/order IDs, provider, unique provider reference, status and creation/update timestamps. Empty until a real payment is initiated.
- `order_events`: immutable-by-convention integration history and a unique provider event key. No provider events are accepted in this branch.
- `order_outbox`: unique `(order_id,event)` and delivery timestamp. Empty until a verified payment is settled.

Future payment settlement must atomically: match the verified merchant/order/amount/currency and environment; record the provider transaction exactly once; transition the order without allowing a late failure to undo a paid state; insert a unique `order.paid` outbox event. A worker then retries delivery to the future CMS queue. Commit payment before attempting CMS delivery, so a CMS outage cannot lose a paid order. The outbox worker, real verification adapter and staff screens are intentionally not implemented in this menu preview.

## Sadad dependencies before integration

Official documentation checked 22 October 2026:

- [Hosted Web Checkout 2.1](https://developer.sadad.qa/web-checkout_2.1/)
- [Required request fields](https://developer.sadad.qa/web-checkout_2.1/request-parameters/)
- [Callback verification](https://developer.sadad.qa/web-checkout_2.1/callback-verification/)
- [Webhook payload and replay handling](https://developer.sadad.qa/web-checkout_2.1/webhook/)

Required from the merchant in server environment configuration (never paste secrets into source or NEXT_PUBLIC variables):

1. Confirm Web Checkout 2.1 is enabled for this merchant; supply merchant ID, website identifier and **test** secret key.
2. Confirm the account's hosted submission endpoint/field contract and obtain genuine signed sandbox callback/webhook fixtures. The public request page uses `signature`; callback/webhook pages use `checksumhash`. Callback text warns against URL-decoding while its PHP example consumes parsed POST values. Resolve encoding/canonicalisation against merchant sandbox fixtures instead of guessing a signing algorithm.
3. Confirm whether customer email is mandatory for this account: the current required-fields page lists it. If required, add an explained email field; never generate a placeholder email.
4. Provide the approved HTTPS return/callback and webhook URLs. Register them with Sadad when a separate test deployment is authorised. The local LAN preview cannot receive public Sadad callbacks.
5. Confirm how the account's QAR currency and test environment are verified: the documented webhook example has no currency field. Bind currency from a trusted server-created attempt and verify through the account's supported transaction-status API if required; do not trust browser return parameters.
6. Implement the hosted provider adapter, verified callback/status reconciliation, atomic replay handling, expiry/retry handling and tests for merchant/order/amount/currency/environment mismatches before enabling payments.
7. Review the existing CSP `form-action 'self'` when adding an actual hosted POST. Allow only the confirmed Sadad checkout origin; no wildcard. Do not change this restriction just for the unconnected preview.

Business details still to confirm before launch: approved Arabic branch names; branch-specific item availability/prices if different; any last-order cutoff or exceptional closures; car-arrival procedure and contact details; customer-data retention and an updated collection privacy notice. No addresses, maps, preparation times, delivery, fees, advance scheduling, refund promises or OTP service have been invented.

## Checks

Run `npm test`, `npx tsc --noEmit`, `npx eslint src/ordering/checkout src/components/checkout src/app/order src/app/api/orders`, and `npx next build --webpack`.

New tests exercise every branch/day opening and closing boundary, overnight Friday/Sunday transitions, Arabic digits and leading plate zeroes, separate portions/notes, authoritative totals, unavailable options/items, price tampering, concurrent idempotency, payload conflicts and the unavailable payment adapter. Browser review covers branch selection, search, 4-/8-piece shrimp roll notes, details validation, review, retries, Arabic and editing. Real Sadad payments, OTP and CMS staff delivery remain untested because they are not connected.
