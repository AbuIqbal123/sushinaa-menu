import { NextResponse } from "next/server";
import {
  adminName,
  authenticated,
  currentStaff,
  validCredentials,
  staffPasswordMatches,
  login,
  logout,
  sameOrigin,
} from "@/cms/auth";
import { auditContext, auditInsert } from "@/cms/audit";
import { db, initDb } from "@/cms/db";
import { clearFailures, recordFailure, signInWait } from "@/cms/login-limit";
export async function GET() {
  const user = await currentStaff();
  if (!user)
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  return NextResponse.json({
    username: user.username,
    role: user.role,
    branchId: user.branchScope.kind === "branch" ? user.branchScope.branchId : null,
  });
}
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  try {
    const body = await request.json();
    const username = typeof body.username === "string" ? body.username : null;
    const audit = auditContext(request, null);
    await initDb();
    const wait = await signInWait(audit.ip, username);
    if (wait)
      return NextResponse.json(
        {
          error: `Too many sign-in attempts. Try again in ${Math.ceil(wait / 60)} minutes.`,
        },
        { status: 429, headers: { "Retry-After": String(wait) } },
      );
    const password = typeof body.password === "string" ? body.password : null;
    const envOk = username !== null && password !== null && validCredentials(username, password);
    const staffOk = !envOk && username !== null && password !== null && await staffPasswordMatches(username, password);
    if (!envOk && !staffOk) {
      await db.batch(
        [
          ...recordFailure(audit.ip, username),
          auditInsert(audit, {
            action: "session.sign_in_failed",
            entityType: "session",
          }),
        ],
        "write",
      );
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 },
      );
    }
    await login(auditContext(request, username), [
      clearFailures(audit.ip, username),
    ], username!);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unable to sign in" }, { status: 400 });
  }
}
export async function DELETE(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const signedIn = await authenticated();
  await logout(signedIn ? auditContext(request, adminName()) : null);
  return NextResponse.json({ ok: true });
}
