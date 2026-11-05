# Sadad checkout runbook

For agents changing online payment or hosted checkout. Update **this file** in the same change.

Product stays **car-collection / pickup**. Customers still order for pickup (name, phone, plate, car, etc.). Sadad only replaces mock / pay-at-pickup for **pay online before collection**. Not delivery. Not dine-in.

## How it works

1. Customer builds a pickup basket → collection details → review.
2. Order is persisted `placed` / `awaiting_payment` with `payment_method=sadad` (or `mock` locally).
3. Browser begins hosted checkout → auto-POST form to Sadad WebCheckout → customer pays off-site.
4. Return path: browser **callback** redirects to `/{branch}/order?paid=…` (not the menu shell — avoids a homepage flash). Kitchen visibility still depends on `paid_at`.
5. Authoritative settle: **webhook** (and/or verified callback) → `applyVerifiedFact` → `settlePayment` (sole paid write).

Staff Orders flow and collection details are unchanged. Refunds: Sadad portal only — not in CMS.

## Layers (why)

| Layer | Role | Where |
| --- | --- | --- |
| UI | Pickup UX + hosted form submit | `OrderingExperience`, `submit-hosted-checkout` |
| HTTP | Begin / browser return / webhook / admin ledger | `api/orders/[id]/pay/begin`, `api/payments/callback`, `api/payments/webhook`, `api/admin/payments` |
| App | Launch + settle orchestration | `checkout/begin-payment`, `payments.settlePayment` / `applyVerifiedFact`, `ledger` |
| Port | Vendor-agnostic gateway | `payment-gateway/port`, `types`, `resolve` |
| Vendor | Signature, fields, verify | `vendors/sadad/*`, `vendors/mock` |

Field names, signature rules, callback/webhook shapes: treat **`private/sadad/`** (gitignored vault; see its README) as source of truth — especially `FIELD_MATRIX.md` and the PDFs. Do not commit secrets there.

## Env (names only)

| Variable | Purpose |
| --- | --- |
| `PAYMENT_PROVIDER` | `mock` \| `pay_at_pickup` \| `sadad` (empty → see resolution below; legacy alias `counter` still accepted) |
| `SADAD_SECRET_KEY` | Merchant secret (Vercel / local env only) |
| `SADAD_MERCHANT_ID` | Merchant id |
| `SADAD_PUBLIC_ORIGIN` | Public https origin, no trailing slash (builds callback URL + `WEBSITE` hostname) |

Also see `.env.example` and `docs/environments.md`. Never put live keys in git.

## Provider resolution

`resolvePaymentProvider()` in `payment-gateway/resolve.ts`:

- Explicit `mock` / `pay_at_pickup` / `sadad` (sadad requires all three `SADAD_*` or ordering is unavailable). Legacy env value `counter` still maps to `pay_at_pickup`.
- Else if `VERCEL_ENV=production` → **pay_at_pickup** until live Sadad cutover.
- Else if `SADAD_*` complete → **sadad**.
- Else → **mock**.

Production must not use explicit `mock` (env guard). Local/CI: leave unset or `mock`.

## EMAIL

Sadad accepts omitting `EMAIL` on WebCheckout. We do not collect email in the customer UI and do not send the field.

## CSP

Hosted checkout POSTs the browser to `https://sadadqa.com/webpurchase`, which then moves to `https://payment.sadadqa.com` for 3DS. `next.config.ts` `form-action` must allow `'self'`, `https://sadadqa.com`, and `https://payment.sadadqa.com`. Without the Sadad hosts, auto-submit / Continue never leave our page.

## Panel checklist (sandbox)

1. Test key domain = exact hostname of `SADAD_PUBLIC_ORIGIN` (today: `test-dev-abu-iqbal-projects.vercel.app`, no `https://`).
2. Webhook URL = `{SADAD_PUBLIC_ORIGIN}/api/payments/webhook`.
3. We send `CALLBACK_URL={SADAD_PUBLIC_ORIGIN}/api/payments/callback` on each launch — it must be HTTPS on that same host.
4. After 3DS success, the browser must POST that callback. If you stay on `payment.sadadqa.com`, our logs will show a `checkout.launch` and **no** `callback.received`.

## Observability

Runtime logs (Vercel → test-dev → Runtime Logs) emit one JSON line per payment event on channel `payment`:

| event | when |
| --- | --- |
| `checkout.launch` | Hosted form built (website + callback host, no secrets) |
| `callback.received` / `callback.verify_failed` / `callback.applied` | Browser return |
| `webhook.received` / `webhook.verify_failed` / `webhook.applied` | Server notify |

Never logged: secret key, checksum/signature values, full phone, card data. Durable trail remains `payment_events` + admin Payments.

Payment logs use `console.warn` / `console.error` (eslint-safe). `next.config.ts` keeps those methods in production builds so they reach Vercel; plain `console.log` is still stripped.

## Callback vs webhook

- **Callback** (`POST /api/payments/callback`): browser return after pay; verify signature; apply fact; respond **200 HTML** that navigates to absolute `{origin}/{branch}/order?paid={orderId}` (pickup receipt recovery via session). Unexpected `GET` is logged and treated as failed return. Do not use relative `Location` — sandbox returns have left the browser on `payment.sadadqa.com`.
- **Webhook** (`POST /api/payments/webhook`): authoritative server notification; verify; `applyVerifiedFact`; ACK `{ status: 'success' }`. Prefer webhook for settlement certainty; callback is UX + best-effort settle.

Both feed the same ledger/`settlePayment` path. Amount must match `orders.total_minor`.

## CMS Payments

Admin-only **Payments** tab: read-only ledger of online pickup pays (`sadad` / `mock`) from `payment_attempts` + `payment_events`. No refund UI. Kitchen/staff status still lives under Orders.

## Environments / cutover

| Site | Payment intent |
| --- | --- |
| Local / CI | `mock` (or unset) |
| `test-dev` | Env **slots** already on Vercel Production: `SADAD_PUBLIC_ORIGIN` set; paste `SADAD_SECRET_KEY` + `SADAD_MERCHANT_ID`; flip `PAYMENT_PROVIDER` from `pay_at_pickup` → `sadad`; register callback/webhook URLs with Sadad; redeploy |
| Production (`sushinaa-menu`) | Stay **pay_at_pickup** until sandbox sign-off; then live key + cutover. Do not push/merge to `main` from agents. PRs → `dev`. |

Migration: `db/migrations/0007_payment_events.sql` (+ schema bootstrap). Apply only via the project’s migration rules — never against live casually.

## Tests

Pure vendor tests: `tests/sadad-signature.test.ts` (no DB). Ordering settle still covered by existing order/payment suites under `PAYMENT_PROVIDER=mock`.
