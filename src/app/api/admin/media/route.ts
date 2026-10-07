import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { authenticated, sameOrigin } from "@/cms/auth";
import { db, initDb } from "@/cms/db";
export async function POST(request: Request) {
  if (!(await authenticated()))
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!sameOrigin(request))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  if (Number(request.headers.get("content-length")) > 6_000_000)
    return NextResponse.json(
      { error: "Maximum upload is 5 MB" },
      { status: 413 },
    );
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (
      !(file instanceof File) ||
      file.size > 5_000_000 ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    )
      return NextResponse.json(
        { error: "Choose a JPEG, PNG or WebP image under 5 MB" },
        { status: 422 },
      );
    const data = await sharp(Buffer.from(await file.arrayBuffer()), {
      limitInputPixels: 40_000_000,
    })
      .rotate()
      .resize(1800, 1800, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
    const id = createHash("sha256").update(data).digest("hex");
    await initDb();
    await db.execute({
      sql: "INSERT OR IGNORE INTO media(id,content,type) VALUES (?,?,?)",
      args: [id, data, "image/webp"],
    });
    return NextResponse.json({ url: `/api/media/${id}` });
  } catch {
    return NextResponse.json(
      { error: "Unable to process this image" },
      { status: 422 },
    );
  }
}
