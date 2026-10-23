/** Live Turso hostname. Hostnames are not secrets. Production must use this host. */
export const LIVE_DATABASE_HOST =
  "sushinaa-cms-vercel-icfg-hv5qrrobt8mmne2b5nzpur3k.aws-ap-south-1.turso.io";

/** True only for the Vercel production deployment. Local and preview are not production. */
export function isProductionDeployment() {
  return process.env.VERCEL_ENV === "production";
}

export function databaseHost(url: string | undefined): string | null {
  if (!url || url.startsWith("file:")) return null;
  try {
    return new URL(url.replace(/^libsql:/, "https:")).hostname;
  } catch {
    return null;
  }
}
