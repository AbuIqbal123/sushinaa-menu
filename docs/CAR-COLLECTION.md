# Car collection — Stage 2 preview

Work stays on `feature/curbside-ordering`; pull requests target `dev`. Real Sadad charging and webhooks remain out of scope.

## Customer journey

`/` is the dev branch picker; `/[branch]` retains the viewing menu. `/order` has an independent basket: choose a branch, browse, then see the original paper receipt, collection details, and review on separate screens. Confirmation keeps Google Maps directions above the receipt. English and Arabic layouts share the same flow.

The four branches, coordinates and hours share `src/branches/branches.ts` and `src/branches/hours.ts`. Phone entry uses +974 and eight national digits. Plates use Q/T/R plus 3–6 digits, preserving leading zeroes. New staff and collection-notice copy is translated into Arabic at the owner's request; final copy review remains parked.

Prices, availability and branch opening hours are checked server-side. Duplicate requests share a session-scoped idempotency key. Pickup orders enter the kitchen immediately; mock orders appear only after server-confirmed mock payment. The gateway collects no card data. Its animation runs after the server response, never as evidence of payment.

## Staff orders

The existing authenticated `/admin` shell has an Orders section with branch/status/date/search filters, 25-row pages, masked contact, an audited contact-reveal action, the paper receipt and status history. Status writes use a conditional update and audit in one transaction; competing writes return `409 STALE_STATUS`. Pickup collection records payment in that same request. Cancellation uses fixed reason codes to keep personal information out of the audit label.

Orders poll every 15 seconds while the tab is visible, including while another admin section is open. A badge counts unread orders. Staff can enable a bundled notification sound; their preference is stored locally. Browser autoplay restrictions may require enabling sound again after opening a new session. Existing menu-management flows are unchanged.

## Storage and safeguards

Orders use the existing CMS database and credentials. `0002_orders.sql` is additive and matches guarded schema bootstrap. Snapshots retain quoted prices in integer minor units. Payment attempts, unique provider events and outbox events remain in the same database. Orders and their outbox entries commit atomically. There is no external outbox delivery worker yet.

Before any order bootstrap/access, the live database hostname is rejected with `503 ORDERING_UNAVAILABLE`; no order tables are created there. CMS behaviour is preserved. Migrations also refuse the live host. Lazy clients allow route imports during a preview build without connecting to the database. A read-only public menu source still runs the environment guard first.

`PAYMENT_PROVIDER` selects `mock` or `counter`. When unset it defaults to mock locally/in preview, and counter in production. Explicit production mock configuration fails at startup/request time, and the mock payment endpoint always returns 404 in production. No Vercel environment variables were added or changed. The old client-only demo switches have been removed; the root never redirects to ordering.

Order APIs use no-store responses, strict validation and stable error codes. Admin writes require authentication and same-origin JSON. Checkout and staff status writes use database-backed IP rate limits; checkout also has a per-session limit. Customer lookup is scoped to an HttpOnly session cookie. Contact is excluded from audit diffs and error responses.

Completed/cancelled orders receive a `purge_after` date 90 days later. The tested server purge function nulls customer fields and snapshot contact, and clears item notes. It currently runs on staff list/detail reads in batches of 100; a scheduled retention worker is still needed before relying on an exact deletion deadline during periods without staff activity. No scheduler or deployment configuration was changed.

## Local verification

Use a fresh scratch database, never the production database. Override any local environment file values:

```sh
export CMS_DATABASE_URL=file:/tmp/sn/menu.db CMS_DATABASE_AUTH_TOKEN=
export CMS_PUBLIC_MENU_SOURCE_URL= CMS_ENV_GUARD=report
export VERCEL= VERCEL_ENV=preview PAYMENT_PROVIDER=
export CMS_ADMIN_USERNAME= CMS_ADMIN_PASSWORD= CMS_TEST_URL=
rm -rf .next
rm -f /tmp/sn/menu.db /tmp/sn/menu.db-shm /tmp/sn/menu.db-wal
npm run lint
npx tsc --noEmit
npm test
npm audit --omit=dev --audit-level=high
npm run ci:secrets
npm run db:check-migrations
npm run cms:seed
npm run build
npm run test:e2e
```

Playwright runs the local server with a test-only clock during shared branch opening hours. No deployed application code changes its clock. Tests cover both languages, payment confirmation, polling, filters, contact auditing, status progression, pickup payment and RTL, alongside the existing CMS suite.

## Parked

- WhatsApp confirmations and ready notifications are on hold at the owner’s request. Before implementation, confirm the number’s Business Platform/API setup, approved bilingual templates and customer opt-in; send only from server-confirmed order/payment/status events. Do not activate messaging yet.
- Confirmation call buttons currently use the general CMS contact number for all four branches, as approved by the owner; replace with direct branch numbers when supplied.

- Real Sadad adapter and signed webhooks; outbound order delivery worker.
- `TODO(owner)`: confirm the 90-day retention period and arrange scheduled purging before production ordering.
- `TODO(ar)`: owner/native reviewer approval of the translated staff and privacy copy.
- Per-branch stock and prices.
- Deployment database split: ordering deliberately stays unavailable on any preview pointing to the live CMS database.
