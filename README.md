# Sushinaa menu CMS

The bilingual QR menu for Sushinaa, backed by a persistent menu CMS. Guests browse dishes with a category dropdown that follows the scroll, bilingual search, and dietary filters. They can save items with individual notes to show staff. Selections stay on the device; nothing is submitted to the kitchen and the menu does not take payment. Prices are in QAR.

## Run locally

Requires Node.js 22+ and npm.

```sh
npm ci
cp .env.example .env.local
npm run cms:seed
npm run dev
```

- Public menu: http://localhost:3005
- Administration: http://localhost:3005/admin
- Local sign-in: set `CMS_ADMIN_USERNAME` and `CMS_ADMIN_PASSWORD` in `.env.local` first. Sign-in is disabled while either is missing.

For phone testing on the same Wi-Fi, allow the computer's exact LAN address:

```bash
SUSHINAA_PREVIEW_HOST=YOUR_LAN_IP npm run dev -- --hostname 0.0.0.0 --webpack
```

Open `http://YOUR_LAN_IP:3005` on the phone. Use development mode for this HTTP preview; production headers require HTTPS for assets.

The seed command inserts the complete original menu (74 dishes, 14 categories) **only when the database is empty**. Re-running it preserves CMS edits. `data/initial-menu.json` is migration input, never a frontend fallback. The original catalog and wording snapshots under `tests/fixtures/` are test references only.

## Manage content

- **Dashboard:** category/item counts, active/hidden items and recently edited dishes.
- **Menu:** search, status filtering, category groups, item creation/editing/deletion, visibility and up/down ordering.
- **Item editor:** bilingual names/descriptions, category, availability, dietary labels, primary photo and alt text, all eight original pricing models, portion prices, proteins, styles, sizes, sauces, extras, included selections and limits. Multiple photos follow the existing protein/style option model; no new gallery changes the customer experience. Upload, replace or remove optional option photos and reorder the associated choices.
- **Categories:** create, rename, reorder, hide/show, and delete empty categories. Move or delete their items before deleting a category.
- **Settings:** restaurant details, logos, currency labels, WhatsApp destination, bilingual menu wording, option field labels and dietary filters. Wording is independently editable in both languages; numbered placeholders insert names/counts.

Saves are published immediately. Refresh the public menu to load the newest content. Hiding a category hides its dishes. Hidden or unavailable dishes cannot be ordered. Removed dishes and invalid saved option selections are excluded from a restored cart. Conflicting saves receive a reload prompt instead of silently overwriting another administrator’s changes.

## Persistence and deployment

Development defaults to the SQLite file `data/menu.db`. Back up that database (including its media and sessions), and keep it on a persistent volume when self-hosting. Do not commit it.

For **Vercel**, set a remote libSQL database before deployment:

- `CMS_DATABASE_URL`: the `libsql://….turso.io` address
- `CMS_DATABASE_AUTH_TOKEN`: the database token
- `CMS_ADMIN_USERNAME` and `CMS_ADMIN_PASSWORD`: your admin sign-in (a long, unique password)

Use those same database environment variables locally and run `npm run cms:seed` once before deploying. The CLI reads `.env.local`/`.env` like Next.js. Do not put database tokens in `NEXT_PUBLIC_*` variables. The application deliberately rejects a local-file database on Vercel, where filesystem changes are not durable. No cloud database has been provisioned by this branch.

Uploaded JPEG/PNG/WebP photos (up to 4 MB, under Vercel's request limit) are decoded, resized and stored as WebP in the database. Their content-addressed media URLs are immutable. Existing bundled photos remain in `public/`; uploads do not depend on an ephemeral deployment filesystem. Removing a photo association keeps the underlying upload available for other items.

For a local production check:

```sh
npm run cms:seed
npm run build
npm start
```

The temporary credential adapter is isolated in `src/cms/auth.ts` for later replacement. Sessions are random, server-stored, expiring and revocable; cookies are HTTP-only, SameSite Strict and secure in production. Every admin data/media mutation verifies authentication and same-origin requests. The public menu and media routes remain public.

## Architecture

```text
Authenticated /admin → validated API → libSQL menu document + media
                                      ↓
                         server data layer → original public menu
```

- `src/cms`: domain validation, persistence, session authentication and public data context.
- `src/components/admin`: focused dashboard, list, settings and item/option editors.
- `src/catalog/types.ts`: existing dish and selection types; `menu.ts` retains filtering logic only.
- `src/ordering`: existing pricing and cart behavior.
- `src/i18n`: language handling and interpolation of database-managed wording.
- `data/initial-menu.json`: deterministic original-menu seed, including resolved Arabic fallbacks.

Category and dish order are explicit numeric fields; nested choice arrays are deliberately ordered sequences. Stable IDs preserve relationships through renames. The complete document is validated on the server and saved atomically with a revision comparison. Public pages share one cached copy of the published menu across requests; a save refreshes it immediately (self-hosted setups with several instances refresh within five minutes). If the database is briefly unreachable, visitors keep seeing the last published menu. Admin screens always read the database. The customer bundle never imports the migration dataset, and only the menu page receives dish data.

## Checks

```sh
npm test
npm run lint
npm run build
npx playwright install chromium
# Against a disposable/test database, after `npm run build`:
npm run test:e2e
```

`npm run test:e2e` starts the built app on port 3006 with an admin account made up for that run. Browser tests edit the menu and restore the prior document afterward; do not point them at a live customer database. To test a server you started yourself, set `CMS_TEST_URL` plus the `CMS_ADMIN_USERNAME` and `CMS_ADMIN_PASSWORD` it uses.

Tests cover migration parity, all pricing types, bilingual interpolation, invalid values, relationship validation, stale saved selections, visibility/order, idempotent seeding, persistent writes, concurrent-save rejection, authentication, category/item workflows, uploads, settings propagation, empty menus and mobile/desktop English/Arabic cart interactions.

The original public stylesheet is unchanged. Before/after mobile and desktop screenshots were reviewed during implementation. Next.js was updated from 16.3.4 to 16.4.0 to resolve the runtime security advisory found during installation. The remaining npm audit findings concern the development-only ESLint glob dependency chain; the suggested automated fix would downgrade the Next.js lint configuration across major versions and was not applied.
