/** Live Turso hostname. Hostnames are not secrets. Production must use this host. */
export const LIVE_DATABASE_HOST =
  "sushinaa-cms-vercel-icfg-hv5qrrobt8mmne2b5nzpur3k.aws-ap-south-1.turso.io";

/** True only for the Vercel production deployment. Local and preview are not production. */
export function isProductionDeployment() {
  return process.env.VERCEL_ENV === "production";
}

function stripTrailingDots(host: string) {
  return host.replace(/\.+$/, "").toLowerCase();
}

export function databaseHost(url: string | undefined): string | null {
  if (!url || url.startsWith("file:")) return null;
  try {
    return stripTrailingDots(
      new URL(url.replace(/^libsql:/i, "https:")).hostname,
    ) || null;
  } catch {
    return null;
  }
}

/**
 * True when the URL names the live Turso host under WHATWG parsing, trailing-dot
 * aliases, or libsql-style userinfo tricks (`evil\@live-host`) that dial the live
 * host even when `databaseHost` returns a different name.
 */
export function touchesLiveDatabaseHost(url: string | undefined) {
  if (!url || url.startsWith("file:")) return false;
  if (databaseHost(url) === LIVE_DATABASE_HOST) return true;
  let decoded = url;
  try {
    decoded = decodeURIComponent(url);
  } catch {
    /* keep raw */
  }
  const haystack = decoded.replace(/\\/g, "").toLowerCase();
  const live = LIVE_DATABASE_HOST.toLowerCase();
  for (let i = haystack.indexOf(live); i !== -1; i = haystack.indexOf(live, i + 1)) {
    const before = haystack[i - 1];
    let end = i + live.length;
    while (haystack[end] === ".") end += 1;
    const after = haystack[end];
    const leftOk = i === 0 || /[^a-z0-9-]/.test(before);
    const rightOk = end >= haystack.length || /[^a-z0-9-]/.test(after);
    if (leftOk && rightOk) return true;
  }
  return false;
}
