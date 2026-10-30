import type { Client } from "@libsql/client";
import {
  databaseHost,
  isProductionDeployment,
  LIVE_DATABASE_HOST,
} from "@/lib/deploy-env";

export type GuardMode = "report" | "enforce";

export function guardMode(): GuardMode {
  return process.env.CMS_ENV_GUARD === "enforce" ? "enforce" : "report";
}

export type GuardFacts = {
  production: boolean;
  databaseUrl: string;
  paymentProvider: string | undefined;
  /** null when the env_marker table or row is absent. */
  marker: string | null;
};

/** Reasons this process must not serve. Empty means the setup matches the rules. */
export function guardProblems(facts: GuardFacts): string[] {
  const host = databaseHost(facts.databaseUrl);
  const problems: string[] = [];
  const mock = facts.paymentProvider?.toLowerCase() === "mock";
  if (facts.production) {
    if (host !== LIVE_DATABASE_HOST)
      problems.push("Production must use the live database hostname.");
    if (mock) problems.push("Production must not use a mock payment provider.");
  } else {
    if (host === LIVE_DATABASE_HOST)
      problems.push("Non-production must not use the live database hostname.");
    if (facts.marker !== "development")
      problems.push("Non-production must have the development marker.");
  }
  return problems;
}

async function readMarker(client: Client): Promise<string | null> {
  try {
    const result = await client.execute(
      "SELECT environment FROM env_marker WHERE id = 1",
    );
    const value = result.rows[0]?.environment;
    return typeof value === "string" ? value : null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/no such table/i.test(message)) return null;
    throw error;
  }
}

let logged = false;

/**
 * Report-only by default: log and continue. CMS_ENV_GUARD=enforce refuses to start.
 * Never includes tokens or full connection strings.
 */
export function assertPaymentProviderAllowed() {
  if (isProductionDeployment() && process.env.PAYMENT_PROVIDER?.toLowerCase() === "mock")
    throw new Error("Production must not use a mock payment provider.");
}

export async function assertDatabaseAllowed(client: Client) {
  assertPaymentProviderAllowed();
  const problems = guardProblems({
    production: isProductionDeployment(),
    databaseUrl: process.env.CMS_DATABASE_URL || "file:./data/menu.db",
    paymentProvider: process.env.PAYMENT_PROVIDER,
    marker: await readMarker(client),
  });
  const mode = guardMode();
  if (!logged) {
    logged = true;
    const line = problems.length
      ? `cms-env-guard ${mode}: ${problems.join(" ")}`
      : "cms-env-guard ok";
    process.stderr.write(`${line}\n`);
  }
  if (problems.length && mode === "enforce") {
    throw new Error(`cms-env-guard: ${problems.join(" ")}`);
  }
}
