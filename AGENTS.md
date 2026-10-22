<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Sushinaa dev and production

Read `docs/environments.md` before touching a database, an env var, or a deployment.

Production is https://sushinaa-menu.vercel.app (`main`, project `sushinaa-menu`, live Turso database). Do not write to it, repoint it, redeploy it, or migrate it. Do not push or merge to `main`.

Dev is https://test-dev-abu-iqbal-projects.vercel.app (project `test-dev`, dev Turso database). Local work uses `data/menu.db` or that dev database. Pull requests go into `dev`.
