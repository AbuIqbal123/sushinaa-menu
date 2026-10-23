import { db, initDb } from "@/cms/db";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^[a-f0-9]{64}$/.test(id)) return new Response(null, { status: 404 });
  await initDb();
  const source = process.env.CMS_PUBLIC_MENU_SOURCE_URL;
  if (source) {
    const origin = new URL(source).origin;
    const upstream = await fetch(`${origin}/api/media/${id}`, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(8000) });
    if (!upstream.ok) return new Response(null, { status: 404 });
    const type = upstream.headers.get('content-type') || '';
    if (!/^image\/(?:jpeg|png|webp|avif)$/.test(type)) return new Response(null, { status: 502 });
    const bytes = await upstream.arrayBuffer();
    if (bytes.byteLength > 5_000_000) return new Response(null, { status: 502 });
    return new Response(bytes, { headers: { 'Content-Type': type, 'Cache-Control': 'public,max-age=3600', 'X-Content-Type-Options': 'nosniff' } });
  }
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
