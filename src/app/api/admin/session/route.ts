import { NextResponse } from "next/server";
import {
  adminName,
  authenticated,
  validCredentials,
  login,
  logout,
  sameOrigin,
} from "@/cms/auth";
import { auditContext, auditInsert } from "@/cms/audit";
import { db, initDb } from "@/cms/db";
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  try {
    const body = await request.json();
    const username = typeof body.username === "string" ? body.username : null;
    if (
      username === null ||
      typeof body.password !== "string" ||
      !validCredentials(username, body.password)
    ) {
      // The attempted name only; never the password.
      await initDb();
      await db.execute(
        auditInsert(auditContext(request, username), {
          action: "session.sign_in_failed",
          entityType: "session",
        }),
      );
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 },
      );
    }
    await login(auditContext(request, adminName()));
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
