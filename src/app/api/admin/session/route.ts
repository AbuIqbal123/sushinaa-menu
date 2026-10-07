import { NextResponse } from "next/server";
import { validCredentials, login, logout, sameOrigin } from "@/cms/auth";
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  try {
    const body = await request.json();
    if (
      typeof body.username !== "string" ||
      typeof body.password !== "string" ||
      !validCredentials(body.username, body.password)
    )
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 },
      );
    await login();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unable to sign in" }, { status: 400 });
  }
}
export async function DELETE(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  await logout();
  return NextResponse.json({ ok: true });
}
