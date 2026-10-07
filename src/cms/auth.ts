import { cookies } from "next/headers";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { db, initDb } from "./db";
const COOKIE = "sushinaa-admin";
const digest = (s: string) => createHash("sha256").update(s).digest("hex");
// Replace this adapter when moving to a real identity provider.
// Fails closed: with no configured credentials nobody can sign in.
export function validCredentials(username: string, password: string) {
  const expectedUsername = process.env.CMS_ADMIN_USERNAME;
  const expectedPassword = process.env.CMS_ADMIN_PASSWORD;
  if (!expectedUsername || !expectedPassword) return false;
  const equal = (a: string, b: string) =>
    timingSafeEqual(Buffer.from(digest(a)), Buffer.from(digest(b)));
  const userOk = equal(username, expectedUsername);
  const passwordOk = equal(password, expectedPassword);
  return userOk && passwordOk;
}
export async function authenticated() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return false;
  await initDb();
  const r = await db.execute({
    sql: "SELECT token FROM sessions WHERE token=? AND expires>?",
    args: [digest(token), Date.now()],
  });
  return r.rows.length > 0;
}
export async function login() {
  await initDb();
  const token = randomBytes(32).toString("hex");
  const maxAge = 60 * 60 * 8;
  await db.execute({
    sql: "DELETE FROM sessions WHERE expires<=?",
    args: [Date.now()],
  });
  await db.execute({
    sql: "INSERT INTO sessions(token,expires) VALUES (?,?)",
    args: [digest(token), Date.now() + maxAge * 1000],
  });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge,
  });
}
export async function logout() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    await initDb();
    await db.execute({
      sql: "DELETE FROM sessions WHERE token=?",
      args: [digest(token)],
    });
  }
  jar.delete(COOKIE);
}
// CSRF check for admin writes: the browser-set Origin must name the host the
// browser sent the request to. Compare with the Host header (or the proxy's
// x-forwarded-host, as Next's server-action check does), not request.url, which
// under `next dev --hostname 0.0.0.0` is the bind address, not the address used.
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0].trim() ||
    request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host.toLowerCase();
  } catch {
    return false;
  }
}
