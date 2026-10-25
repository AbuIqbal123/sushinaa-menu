import { cookies } from "next/headers";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { db, initDb } from "./db";
import type { InStatement } from "@libsql/client";
import { auditInsert, type AuditContext } from "./audit";
import { hashPassword, verifyPassword } from "./passwords";
import type { Role } from "./permissions";
import { scopeFor, type BranchScope } from "@/ordering/scope";
const COOKIE = "sushinaa-admin";
export const tokenHash = (s: string) => createHash("sha256").update(s).digest("hex");
const digest = tokenHash;

export type StaffPrincipal = {
  userId: string;
  username: string;
  role: Role;
  branchScope: BranchScope;
};
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
// The one admin account; recorded as who made each change.
export function adminName() {
  return process.env.CMS_ADMIN_USERNAME ?? null;
}
async function upsertEnvAdmin() {
  const username = adminName();
  const password = process.env.CMS_ADMIN_PASSWORD;
  if (!username || !password) return;
  const passwordHash = await hashPassword(password);
  const now = new Date().toISOString();
  const existing = (
    await db.execute({ sql: "SELECT id FROM staff_users WHERE username=?", args: [username] })
  ).rows[0];
  if (!existing) {
    await db.execute({
      sql: `INSERT INTO staff_users (id,username,password_hash,role,branch_id,auth_version,disabled_at,created_at,updated_at)
        VALUES (?,?,?,'admin',NULL,1,NULL,?,?)`,
      args: [`US-${randomUUID()}`, username, passwordHash, now, now],
    });
    return;
  }
  await db.execute({
    sql: "UPDATE staff_users SET password_hash=?, role='admin', branch_id=NULL, disabled_at=NULL, updated_at=? WHERE id=?",
    args: [passwordHash, now, String(existing.id)],
  });
}

export async function staffPasswordMatches(username: string, password: string) {
  await initDb();
  const row = (
    await db.execute({
      sql: "SELECT password_hash, disabled_at FROM staff_users WHERE username=?",
      args: [username],
    })
  ).rows[0];
  if (!row || row.disabled_at) {
    await verifyPassword(password, "scrypt$00$00");
    return false;
  }
  return verifyPassword(password, String(row.password_hash));
}

export async function staffFromToken(token: string | undefined): Promise<StaffPrincipal | null> {
  if (!token) return null;
  await initDb();
  const row = (
    await db.execute({
      sql: `SELECT u.id, u.username, u.role, u.branch_id
        FROM staff_sessions s
        JOIN staff_users u ON u.id = s.user_id AND u.auth_version = s.auth_version
        WHERE s.token_hash=? AND s.expires>? AND u.disabled_at IS NULL`,
      args: [digest(token), Date.now()],
    })
  ).rows[0];
  if (!row) return null;
  const role: Role = row.role === "admin" ? "admin" : "branch_staff";
  return {
    userId: String(row.id),
    username: String(row.username),
    role,
    branchScope: scopeFor(role, row.branch_id == null ? null : String(row.branch_id)),
  };
}

export async function currentStaff() {
  const token = (await cookies()).get(COOKIE)?.value;
  return staffFromToken(token);
}

export async function authenticated() {
  return (await currentStaff()) !== null;
}
/** Starts a fresh session; any session this browser already had is ended. */
export async function login(audit: AuditContext, also: InStatement[] = [], username?: string) {
  await initDb();
  const name = username ?? adminName();
  if (!name) throw new Error("Sign-in is not configured");
  if (name === adminName()) await upsertEnvAdmin();
  const user = (
    await db.execute({
      sql: "SELECT id, auth_version, disabled_at FROM staff_users WHERE username=?",
      args: [name],
    })
  ).rows[0];
  if (!user || user.disabled_at) throw new Error("Sign-in failed");
  const jar = await cookies();
  const previous = jar.get(COOKIE)?.value;
  const token = randomBytes(32).toString("hex");
  const maxAge = 60 * 60 * 8;
  const now = Date.now();
  await db.batch(
    [
      ...also,
      { sql: "DELETE FROM staff_sessions WHERE expires<=?", args: [now] },
      ...(previous
        ? [{ sql: "DELETE FROM staff_sessions WHERE token_hash=?", args: [digest(previous)] }]
        : []),
      {
        sql: "INSERT INTO staff_sessions (token_hash,user_id,auth_version,expires,created_at) VALUES (?,?,?,?,?)",
        args: [digest(token), String(user.id), Number(user.auth_version), now + maxAge * 1000, new Date(now).toISOString()],
      },
      auditInsert(audit, { action: "session.sign_in", entityType: "session" }),
    ],
    "write",
  );
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge,
  });
}
/** Ends the session; a signed-in session is recorded as a sign-out. */
export async function logout(audit: AuditContext | null) {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    await initDb();
    await db.batch(
      [
        { sql: "DELETE FROM staff_sessions WHERE token_hash=?", args: [digest(token)] },
        ...(audit
          ? [auditInsert(audit, { action: "session.sign_out", entityType: "session" })]
          : []),
      ],
      "write",
    );
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
