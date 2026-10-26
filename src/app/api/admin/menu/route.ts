import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { currentStaff, sameOrigin } from "@/cms/auth";
import { auditContext } from "@/cms/audit";
import {
  readMenu,
  saveMenu,
  ConflictError,
  ContentError,
  MENU_CACHE_TAG,
} from "@/cms/repository";
import { ZodError } from "zod";
export const dynamic = "force-dynamic";
async function editor() {
  const user = await currentStaff();
  if (!user) return { user: null, response: NextResponse.json({ error: "Sign in required" }, { status: 401 }) };
  if (user.role !== "admin") return { user: null, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { user, response: null };
}
export async function GET() {
  const gate = await editor();
  if (gate.response) return gate.response;
  return NextResponse.json(await readMenu(), {
    headers: { "Cache-Control": "no-store" },
  });
}
export async function PUT(request: Request) {
  const gate = await editor();
  if (gate.response) return gate.response;
  if (!sameOrigin(request))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  try {
    const raw = await request.text();
    if (raw.length > 2_000_000)
      return NextResponse.json({ error: "Menu is too large" }, { status: 413 });
    const { menu, revision } = JSON.parse(raw);
    if (!Number.isSafeInteger(revision) || revision < 1)
      return NextResponse.json({ error: "Invalid revision" }, { status: 400 });
    const saved = await saveMenu(
      menu,
      revision,
      auditContext(request, gate.user.username),
    );
    // Publish immediately: the next public request reads the new revision.
    revalidateTag(MENU_CACHE_TAG, { expire: 0 });
    return NextResponse.json(saved);
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
