import { NextResponse } from "next/server";
import { authenticated, sameOrigin } from "@/cms/auth";
import {
  readMenu,
  saveMenu,
  ConflictError,
  ContentError,
} from "@/cms/repository";
import { ZodError } from "zod";
export const dynamic = "force-dynamic";
export async function GET() {
  if (!(await authenticated()))
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  return NextResponse.json(await readMenu(), {
    headers: { "Cache-Control": "no-store" },
  });
}
export async function PUT(request: Request) {
  if (!(await authenticated()))
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!sameOrigin(request))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  try {
    const raw = await request.text();
    if (raw.length > 2_000_000)
      return NextResponse.json({ error: "Menu is too large" }, { status: 413 });
    const { menu, revision } = JSON.parse(raw);
    if (!Number.isSafeInteger(revision) || revision < 1)
      return NextResponse.json({ error: "Invalid revision" }, { status: 400 });
    return NextResponse.json(await saveMenu(menu, revision));
  } catch (e) {
    if (e instanceof SyntaxError)
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    if (e instanceof ContentError)
      return NextResponse.json({ error: e.message }, { status: 422 });
    if (e instanceof ZodError)
      return NextResponse.json(
        {
          error: e.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("\n"),
        },
        { status: 422 },
      );
    if (e instanceof ConflictError)
      return NextResponse.json({ error: e.message }, { status: 409 });
    return NextResponse.json(
      { error: "Unable to save the menu" },
      { status: 500 },
    );
  }
}
