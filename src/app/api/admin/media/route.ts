import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { adminName, authenticated, sameOrigin } from "@/cms/auth";
import { auditContext, auditInsert } from "@/cms/audit";
import { db, initDb } from "@/cms/db";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL, sniffImage } from "@/cms/media";
export async function POST(request: Request) {
  if (!(await authenticated()))
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!sameOrigin(request))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  if (Number(request.headers.get("content-length")) > MAX_UPLOAD_BYTES + 100_000)
    return NextResponse.json(
      { error: `Maximum upload is ${MAX_UPLOAD_LABEL}` },
      { status: 413 },
    );
  try {
    const form = await request.formData();
    const file = form.get("file");
    const refuse = () =>
      NextResponse.json(
        { error: `Choose a JPEG, PNG or WebP image under ${MAX_UPLOAD_LABEL}` },
        { status: 422 },
      );
    if (!(file instanceof File) || file.size > MAX_UPLOAD_BYTES) return refuse();
    // Trust the bytes, not the name or the browser's type: anything else,
    // SVG included, is refused before it reaches the decoder.
    const bytes = Buffer.from(await file.arrayBuffer());
    const kind = sniffImage(bytes);
    if (!kind) return refuse();
    const data = await sharp(bytes, {
      limitInputPixels: 40_000_000,
      failOn: "error",
    })
      .rotate()
      .resize(1800, 1800, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
    const id = createHash("sha256").update(data).digest("hex");
    await initDb();
    await db.batch(
      [
        {
          sql: "INSERT OR IGNORE INTO media(id,content,type) VALUES (?,?,?)",
          args: [id, data, "image/webp"],
        },
        auditInsert(auditContext(request, adminName()), {
          action: "media.upload",
          entityType: "media",
          entityId: id,
          label: file.name,
          diff: { type: "image/webp", bytes: data.length },
        }),
      ],
      "write",
    );
    return NextResponse.json({ url: `/api/media/${id}` });
  } catch {
    return NextResponse.json(
      { error: "Unable to process this image" },
      { status: 422 },
    );
  }
}
