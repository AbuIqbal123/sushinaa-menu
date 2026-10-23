# Environments

Production stays on the live Turso database. Preview and local development use the dev database, or a local file for development. Nothing outside production may use the live hostname.

The copy command reads `SOURCE_DATABASE_URL` and `SOURCE_DATABASE_AUTH_TOKEN` (a read-only, short-lived token) and writes `TARGET_DATABASE_URL` and `TARGET_DATABASE_AUTH_TOKEN`. Those four are not Vercel env vars. The live database is never the target.

| Variable | Production | Preview (dev site) | Development (local) | Notes |
| --- | --- | --- | --- | --- |
| `CMS_DATABASE_URL` | Live DB, unchanged | Dev DB | `file:./data/menu.db` (default) or dev DB | Never the live DB outside production |
| `CMS_DATABASE_AUTH_TOKEN` | Live DB token, unchanged | Dev-only token | Dev-only token or empty | One-database tokens, not group tokens |
| `CMS_ADMIN_USERNAME` / `CMS_ADMIN_PASSWORD` | Live, unchanged | Different dev values | Local values | Never reuse the live password |
| `CMS_ENV_GUARD` | `report` until it is switched to `enforce` | `report`, then `enforce` | `report` | `enforce` refuses to start when the check fails |
| `PAYMENT_PROVIDER` (later) | `counter` (pay at pickup) | `mock` | `mock` | Mock is refused in production |
| `MOCK_WEBHOOK_SECRET` (later) | Not set | Dev secret | Local random | |
| Gateway keys (later) | Live keys | Sandbox keys | Sandbox keys | Server only, never `NEXT_PUBLIC_` |
| Printer credentials (later) | Stored hashed in the live DB | Stored hashed in the dev DB, test printer | Simulator | Not env vars |
| `BLOB_READ_WRITE_TOKEN` (backups, later) | Prod Blob store | Not set, or a separate dev store | Not set | |
| `CRON_SECRET` (later) | Prod value | Dev value | Not set | |
| Read-only prod token for copying | Never in Vercel | Never in Vercel | Machine only, short expiry | Revoke after each copy |

Each variable is its own entry per environment. A preview build cannot read a production value.
