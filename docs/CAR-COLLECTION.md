# Car collection — Stage 2 preview

Work stays on `feature/curbside-ordering`; pull requests target `dev`.

## Current build-repair checkpoint

- `/` is the dev branch picker; `/[branch]` retains the viewing menu and its basket.
- `/order` has an independent basket, the original paper ticket, then collection details, then review on separate screens. The final preview keeps directions prominent.
- The four branches, coordinates and hours now share `src/branches/branches.ts` and `src/branches/hours.ts`.
- Phone entry uses +974 and eight national digits. Plates use Q/T/R plus 3–6 digits, preserving leading zeroes.
- Menu/price validation and session-scoped idempotency remain server-side.
- Orders use the existing CMS database. There is no separate order database or credential.
- Before any order access or bootstrap, the live host is rejected. CMS behaviour on the live database is preserved, but order tables are excluded. Migrations also refuse that host.
- Clients and connections are lazy: importing route modules during a preview build does not require ordering configuration.
- The public menu source, when configured, is read-only and still runs `initDb` and its environment guard first. It cannot replace database environment validation.
- `NEXT_PUBLIC_ORDERING_DEMO_MODE` only selects the existing visual simulation. It does not enable an order API or real payments. The root never redirects to `/order`.
- Production mock payment configuration fails at runtime/startup even when the CMS guard is report-only.

## Local verification

Use a fresh scratch database, never the production database:

```sh
export CMS_DATABASE_URL=file:/tmp/sn/menu.db
export CMS_DATABASE_AUTH_TOKEN=
export CMS_PUBLIC_MENU_SOURCE_URL=
export CMS_ENV_GUARD=report
export VERCEL_ENV=preview
npm run cms:seed
npm run build
npm run test:e2e
```

`0002_orders.sql` is additive and matches the guarded bootstrap. Orders store a versioned snapshot, integer minor-unit totals, customer fields and a single lifecycle status. The payment attempts, provider events and outbox tables are preserved.

## Next checkpoint

Wait for the build-repair PR's `check` and Vercel preview to pass before implementing staff order management, server mock settlement, rate limits, privacy retention and their browser tests. Current public draft payment remains visual only. Real Sadad charging and webhooks are out of scope.

Parked: real Sadad adapter/webhooks; `TODO(owner)` confirmation of the 90-day retention period; `TODO(ar)` review of existing and new Arabic checkout/staff copy; per-branch stock and pricing.
