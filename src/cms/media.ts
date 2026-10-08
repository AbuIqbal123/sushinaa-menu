// Uploads stay under Vercel's 4.5 MB request body limit, form overhead included.
export const MAX_UPLOAD_BYTES = 4_000_000;
export const MAX_UPLOAD_LABEL = "4 MB";

/** The image type from the file's first bytes, never its name or claimed type. */
export function sniffImage(bytes: Uint8Array): "jpeg" | "png" | "webp" | null {
  const at = (offset: number, sig: number[]) => sig.every((b, i) => bytes[offset + i] === b);
  if (at(0, [0xff, 0xd8, 0xff])) return "jpeg";
  if (at(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (at(0, [0x52, 0x49, 0x46, 0x46]) && at(8, [0x57, 0x45, 0x42, 0x50])) return "webp";
  return null;
}
