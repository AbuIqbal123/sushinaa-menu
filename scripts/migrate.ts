import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { databaseHost, LIVE_DATABASE_HOST } from "../src/lib/deploy-env";

const MIGRATIONS = join(process.cwd(), "db/migrations");

const MIGRATION_TABLE = `CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  checksum TEXT NOT NULL,
  applied_at TEXT NOT NULL
)`;

export class MigrateRefused extends Error {}

export async function migrate(url: string, authToken?: string) {
  if (databaseHost(url) === LIVE_DATABASE_HOST) {
    throw new MigrateRefused("Refusing to migrate the live database.");
  }
  const client = createClient({ url, authToken });
  try {
    await client.execute(MIGRATION_TABLE);
    const applied = await client.execute("SELECT id, checksum FROM schema_migrations");
    const seen = new Map(applied.rows.map((row) => [String(row.id), String(row.checksum)]));
    const files = readdirSync(MIGRATIONS)
      .filter((name) => name.endsWith(".sql"))
      .sort();
    let ran = 0;
    for (const name of files) {
      const id = name.slice(0, 4);
      const sql = readFileSync(join(MIGRATIONS, name), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const previous = seen.get(id);
      if (previous) {
        if (previous !== checksum) {
          throw new MigrateRefused(`Migration ${name} changed after it was applied.`);
        }
        continue;
      }
      await client.executeMultiple(sql);
      await client.execute({
        sql: "INSERT INTO schema_migrations (id, name, checksum, applied_at) VALUES (?, ?, ?, ?)",
        args: [id, name, checksum, new Date().toISOString()],
      });
      ran += 1;
    }
    return ran;
  } finally {
    client.close();
  }
}

async function main() {
  const url = process.env.CMS_DATABASE_URL || "file:./data/menu.db";
  const ran = await migrate(url, process.env.CMS_DATABASE_AUTH_TOKEN);
  process.stdout.write(ran ? `Applied ${ran} migration(s).\n` : "No pending migrations.\n");
}

const invoked = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"));
if (invoked) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : "Migration failed."}\n`);
    process.exitCode = 1;
  });
}
