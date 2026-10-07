import { db, initDb } from "@/cms/db";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^[a-f0-9]{64}$/.test(id)) return new Response(null, { status: 404 });
  await initDb();
  const r = await db.execute({
    sql: "SELECT content,type FROM media WHERE id=?",
    args: [id],
  });
  if (!r.rows[0]) return new Response(null, { status: 404 });
  return new Response(r.rows[0].content as ArrayBuffer, {
    headers: {
      "Content-Type": String(r.rows[0].type),
      "Cache-Control": "public,max-age=31536000,immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
