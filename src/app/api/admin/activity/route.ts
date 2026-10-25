import { NextResponse } from "next/server";
import { currentStaff } from "@/cms/auth";
import { db, initDb } from "@/cms/db";
export const dynamic = "force-dynamic";
// Read-only: the activity log has no write path through the API.
const AREAS: Record<string, string[]> = {
  sessions: ["session"],
  items: ["item"],
  categories: ["category"],
  settings: ["settings", "copy", "fields", "filter"],
  media: ["media"],
  orders: ["order"],
};
const PAGE_SIZE = 50;
export async function GET(request: Request) {
  const user = await currentStaff();
  if (!user)
    return NextResponse.json({ error: "Sign in required" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  if (user.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  const params = new URL(request.url).searchParams;
  const types = AREAS[params.get("area") ?? ""];
  const page = Math.min(1000, Math.max(1, Number(params.get("page")) || 1));
  await initDb();
  const where = types ? `WHERE entity_type IN (${types.map(() => "?").join(",")})` : "";
  const result = await db.execute({
    sql: `SELECT id,at,actor,action,entity_type,entity_id,label,diff,ip,user_agent FROM audit ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
    args: [...(types ?? []), PAGE_SIZE + 1, (page - 1) * PAGE_SIZE],
  });
  const rows = result.rows.slice(0, PAGE_SIZE).map((r) => ({
    id: Number(r.id),
    at: String(r.at),
    actor: r.actor === null ? null : String(r.actor),
    action: String(r.action),
    entityType: String(r.entity_type),
    entityId: r.entity_id === null ? null : String(r.entity_id),
    label: r.label === null ? null : String(r.label),
    diff: r.diff === null ? null : JSON.parse(String(r.diff)),
    ip: r.ip === null ? null : String(r.ip),
    userAgent: r.user_agent === null ? null : String(r.user_agent),
  }));
  return NextResponse.json(
    { rows, page, more: result.rows.length > PAGE_SIZE },
    { headers: { "Cache-Control": "no-store" } },
  );
}
