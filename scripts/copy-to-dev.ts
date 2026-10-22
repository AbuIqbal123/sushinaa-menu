import { createClient, type Client, type InValue } from "@libsql/client";
import { databaseHost, LIVE_DATABASE_HOST } from "../src/lib/deploy-env";

const MENU_SQL = "SELECT id, revision, content FROM menu WHERE id = 1";
const MEDIA_SQL = "SELECT id, content, type FROM media";

const TARGET_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS menu (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, content TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY, content BLOB NOT NULL, type TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS env_marker (id INTEGER PRIMARY KEY CHECK (id = 1), environment TEXT NOT NULL)`,
];

export class CopyRefused extends Error {}

/** A source client that can only run the two allowlisted reads. */
export function readOnlySource(client: Client): Client {
  const read = async (sql: string) => {
    const text = sql.trim();
    if (text !== MENU_SQL && text !== MEDIA_SQL) {
      throw new CopyRefused("The source database is read-only. Only menu and media may be read.");
    }
    return client.execute(text);
  };
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === "execute") return (sql: string) => read(String(sql));
      if (prop === "batch" || prop === "transaction" || prop === "executeMultiple" || prop === "migrate") {
        return async () => {
          throw new CopyRefused("The source database is read-only.");
        };
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

async function marker(client: Client): Promise<string | null> {
  try {
    const result = await client.execute("SELECT environment FROM env_marker WHERE id = 1");
    const value = result.rows[0]?.environment;
    return typeof value === "string" ? value : null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/no such table/i.test(message)) return null;
    throw error;
  }
}

export type CopyEndpoints = {
  sourceUrl: string;
  sourceToken?: string;
  targetUrl: string;
  targetToken?: string;
  /** Tests copy between file databases. The CLI never sets this. */
  allowFileFixture?: boolean;
};

export async function copyMenuAndMedia(endpoints: CopyEndpoints) {
  const sourceHost = databaseHost(endpoints.sourceUrl);
  const targetHost = databaseHost(endpoints.targetUrl);
  if (targetHost === LIVE_DATABASE_HOST) {
    throw new CopyRefused("Refusing to write to the live database.");
  }
  if (endpoints.sourceUrl === endpoints.targetUrl) {
    throw new CopyRefused("Source and target must be different databases.");
  }
  const fileFixture =
    endpoints.allowFileFixture &&
    endpoints.sourceUrl.startsWith("file:") &&
    endpoints.targetUrl.startsWith("file:");
  if (!fileFixture && sourceHost !== LIVE_DATABASE_HOST) {
    throw new CopyRefused("The source must be the live database.");
  }

  const source = readOnlySource(
    createClient({ url: endpoints.sourceUrl, authToken: endpoints.sourceToken }),
  );
  const target = createClient({ url: endpoints.targetUrl, authToken: endpoints.targetToken });
  try {
    const current = await marker(target);
    if (current !== null && current !== "development") {
      throw new CopyRefused("Refusing to write. The target marker is not development.");
    }
    await target.batch(TARGET_SCHEMA, "write");
    if (current === null) {
      await target.execute("INSERT INTO env_marker (id, environment) VALUES (1, 'development')");
    }

    const menu = await source.execute(MENU_SQL);
    const media = await source.execute(MEDIA_SQL);
    const row = menu.rows[0];
    if (!row) throw new CopyRefused("The source menu row is missing.");

    const statements: { sql: string; args: InValue[] }[] = [
      { sql: "DELETE FROM media", args: [] },
      { sql: "DELETE FROM menu", args: [] },
      {
        sql: "INSERT INTO menu (id, revision, content) VALUES (?, ?, ?)",
        args: [Number(row.id), Number(row.revision), String(row.content)],
      },
    ];
    for (const item of media.rows) {
      const bytes = item.content;
      const blob =
        bytes instanceof Uint8Array
          ? bytes
          : bytes instanceof ArrayBuffer
            ? new Uint8Array(bytes)
            : typeof bytes === "string"
              ? Buffer.from(bytes)
              : null;
      if (!blob) throw new CopyRefused("A media row has no content.");
      statements.push({
        sql: "INSERT INTO media (id, content, type) VALUES (?, ?, ?)",
        args: [String(item.id), blob, String(item.type)],
      });
    }
    await target.batch(statements, "write");
    const content = JSON.parse(String(row.content)) as { dishes?: unknown[] };
    return {
      revision: Number(row.revision),
      dishes: Array.isArray(content.dishes) ? content.dishes.length : 0,
      media: media.rows.length,
    };
  } finally {
    source.close();
    target.close();
  }
}

async function main() {
  const sourceUrl = process.env.SOURCE_DATABASE_URL;
  const targetUrl = process.env.TARGET_DATABASE_URL;
  if (!sourceUrl || !targetUrl) {
    throw new CopyRefused("Set SOURCE_DATABASE_URL and TARGET_DATABASE_URL.");
  }
  const result = await copyMenuAndMedia({
    sourceUrl,
    sourceToken: process.env.SOURCE_DATABASE_AUTH_TOKEN,
    targetUrl,
    targetToken: process.env.TARGET_DATABASE_AUTH_TOKEN,
  });
  process.stdout.write(
    `Copied menu revision ${result.revision}, ${result.dishes} dishes, ${result.media} media rows.\n`,
  );
}

const invoked = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"));
if (invoked) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : "Copy failed."}\n`);
    process.exitCode = 1;
  });
}
