import type { InStatement } from "@libsql/client";
import { db } from "./db";

// Failed sign-ins are counted in the database (in-memory counters don't
// survive serverless instances): 5 per address and username, 20 per address,
// in a 15-minute window. A success clears the address-and-username count.
// The table is created with the others in db.ts.
const WINDOW_MS = 15 * 60 * 1000;
const keys = (ip: string | null, username: string | null) => ({
  pair: `pair:${ip ?? "unknown"}|${[...(username ?? "").toLowerCase()].slice(0, 64).join("")}`,
  ip: `ip:${ip ?? "unknown"}`,
});
const LIMITS = { pair: 5, ip: 20 } as const;

/** Seconds until another attempt is allowed, or 0 when it is. */
export async function signInWait(ip: string | null, username: string | null, now = Date.now()) {
  const k = keys(ip, username);
  const r = await db.execute({
    sql: "SELECT key,failures,started FROM login_attempts WHERE key IN (?,?) AND started>?",
    args: [k.pair, k.ip, now - WINDOW_MS],
  });
  let wait = 0;
  for (const row of r.rows) {
    const limit = row.key === k.pair ? LIMITS.pair : LIMITS.ip;
    if (Number(row.failures) >= limit)
      wait = Math.max(wait, Math.ceil((Number(row.started) + WINDOW_MS - now) / 1000));
  }
  return wait;
}

/** Counts one failure for the address and the address-and-username pair. */
export function recordFailure(ip: string | null, username: string | null, now = Date.now()): InStatement[] {
  const k = keys(ip, username);
  const expired = now - WINDOW_MS;
  return [
    { sql: "DELETE FROM login_attempts WHERE started<=?", args: [expired] },
    ...[k.pair, k.ip].map((key) => ({
      sql: "INSERT INTO login_attempts(key,failures,started) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET failures=failures+1",
      args: [key, now],
    })),
  ];
}

export function clearFailures(ip: string | null, username: string | null): InStatement {
  return { sql: "DELETE FROM login_attempts WHERE key=?", args: [keys(ip, username).pair] };
}
