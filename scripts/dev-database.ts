import { databaseHost, LIVE_DATABASE_HOST } from "../src/lib/deploy-env";

export function allowFileFixture(argv = process.argv) {
  return argv.includes("--allow-file-fixture");
}

/** Exits 1 before any database client exists. */
export function assertDevDatabase(argv = process.argv) {
  if (process.env.VERCEL_ENV === "production") {
    console.error("Refusing to run: VERCEL_ENV is production.");
    process.exit(1);
  }
  const url = process.env.CMS_DATABASE_URL || "";
  if (!url) {
    console.error("Refusing to run: CMS_DATABASE_URL is missing.");
    process.exit(1);
  }
  if (databaseHost(url) === LIVE_DATABASE_HOST) {
    console.error("Refusing to run: live database host.");
    process.exit(1);
  }
  if (url.startsWith("file:")) {
    if (!allowFileFixture(argv)) {
      console.error("Refusing to run: file database.");
      process.exit(1);
    }
    return;
  }
  if (!databaseHost(url) || !/^(libsql|https):/.test(url)) {
    console.error("Refusing to run: database URL is not a remote dev database.");
    process.exit(1);
  }
}

export async function assertDevelopmentMarker() {
  const { db } = await import("../src/cms/db");
  let environment: string | null = null;
  try {
    const row = (await db.execute("SELECT environment FROM env_marker WHERE id = 1")).rows[0];
    environment = row ? String(row.environment) : null;
  } catch {
    environment = null;
  }
  if (environment !== "development") {
    console.error("Refusing to run: env_marker.environment is not development.");
    process.exit(1);
  }
}
