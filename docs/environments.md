# Environments

Sushinaa has two databases and two sites. Production is the live restaurant menu. Dev is a copy for building and showing work. They must not share a database.

## Sites

| Site | URL | Git | Vercel project | Database |
| --- | --- | --- | --- | --- |
| Production | https://sushinaa-menu.vercel.app | `main` | `sushinaa-menu` | Live Turso database `sushinaa-cms` |
| Dev (public) | https://test-dev-abu-iqbal-projects.vercel.app | `dev`, deployed as that project's production | `test-dev` | Dev Turso database `sushinaa-cms-dev` |
| Local | http://localhost:3005 | any branch | none | `file:./data/menu.db`, unless you point it at the dev database |

"Preview" is a Vercel word for a deployment that is not the production deployment of a project, such as a pull request. It is not the dev site. Do not treat a `sushinaa-menu` preview as a safe place to edit the menu. The dev site is `test-dev`.

The public dev URL is a deploy of `dev` at the split (`99b1499`). A later push to `dev` does not update https://test-dev-abu-iqbal-projects.vercel.app by itself. Redeploy the `test-dev` project to refresh it. `https://test-dev.vercel.app` is not ours.

## Databases

Both databases are in `aws-ap-south-1`. The app reads `CMS_DATABASE_URL` and `CMS_DATABASE_AUTH_TOKEN`. It does not read `TURSO_*`.

The live hostname is fixed in `src/lib/deploy-env.ts`:

`sushinaa-cms-vercel-icfg-hv5qrrobt8mmne2b5nzpur3k.aws-ap-south-1.turso.io`

The dev hostname starts with `sushinaa-cms-dev-`. The dev database has an `env_marker` row of `development`. Production has no marker. Do not add one.

## Rules

- Do not write, repoint, redeploy, or migrate production. Do not push or merge to `main`. Abu releases `dev` to `main`.
- Do not put the live hostname or the live token on any project except production of `sushinaa-menu`.
- Do not run `npm run db:migrate` against either Turso database or against `data/menu.db`.
- Do not run browser tests against the live database.
- Do not print tokens, passwords, or `.env` files. Do not commit them.
- Each environment variable is its own entry. Do not tick one entry for Production and Development together.
- Tokens are for one database, never a group token. A read-only copy token is created for that run only and is not a Vercel variable. Turso cannot revoke one database token without invalidating every token on that database, which would break production. Do not run `turso db tokens invalidate` on `sushinaa-cms`.

## Variables on `sushinaa-menu`

| Variable | Production | Development | Preview |
| --- | --- | --- | --- |
| `CMS_DATABASE_URL` / `CMS_DATABASE_AUTH_TOKEN` | Live database. Do not edit. | `sushinaa-cms-dev` | Not set. Leave it unset. |
| `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` | Live database. Do not edit. | Not set | Not set |
| `CMS_ADMIN_USERNAME` / `CMS_ADMIN_PASSWORD` | Live admin. Do not edit. | `dev-admin` and a different password | Old preview values. Ignore. |
| `DEV_TURSO_DATABASE_URL` / `DEV_TURSO_AUTH_TOKEN` | Not set | Dev database | Dev database |
| `CMS_ENV_GUARD` | Unset, which means `report` | `report` | Unset |

`test-dev` production has `CMS_DATABASE_URL`, `CMS_DATABASE_AUTH_TOKEN`, and `CMS_ENV_GUARD=report` for the dev database only. It has no admin password, so its CMS sign-in fails closed. The dev admin password lives in the Development environment of `sushinaa-menu`, not in git.

## Guard

`src/instrumentation.ts` and `initDb()` check the database once at startup.

- Production (`VERCEL_ENV=production`) must use the live hostname and must not use a mock payment provider.
- Anything else must not use the live hostname and must see the `development` marker.
- `CMS_ENV_GUARD=enforce` refuses to start. Any other value, including unset, only logs. The log prefix is `cms-env-guard` and it does not include URLs or tokens.
- Leave the guard on `report` until Abu switches it, dev first, then `main`.

`test-dev` is the production deployment of its own project, so `VERCEL_ENV` is `production` there. The guard logs that this is not the live hostname and still serves, because the flag is `report`. That log is expected. It also means `test-dev` does not send `noindex`.

On `sushinaa-menu`, a deployment that is not production sends `X-Robots-Tag: noindex, nofollow`, `robots.ts` disallows all, and the page robots meta is noindex.

## Copy and migrations

`npm run db:copy-to-dev` reads only `menu` and `media` from `SOURCE_DATABASE_URL` with a read-only token, and writes them to `TARGET_DATABASE_URL`. It refuses the live hostname as a target, refuses a target whose marker is not `development`, and writes that marker on an empty target. It does not read `sessions`, `audit`, or `login_attempts`. Run it again to refresh dev. Those four variables are shell variables for that command, not Vercel variables.

`npm run db:migrate` applies numbered files in `db/migrations/` and records them in `schema_migrations`. `0001_baseline.sql` is the current schema and uses `IF NOT EXISTS` only. CI fails a migration line that contains `DROP` or `RENAME`.

## Git

Feature branches open pull requests into `dev`. `dev` requires a pull request and a passing `check`. `main` requires a pull request and passing `check` and `browser`. Force-push and deletion are blocked on both. Do not add a rule that blocks all updates to `dev`. That stops merges.

Browser tests run in CI only on pull requests into `main`. CI audits production dependencies (`npm audit --omit=dev --audit-level=high`). The full tree still reports `braces` 3.0.3 through `eslint-config-next`. That is the newest release. Do not use `npm audit fix --force`.
