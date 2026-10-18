/**
 * Product image storage.
 * - Production: Vercel Blob (BLOB_READ_WRITE_TOKEN), public CDN URLs.
 * - Local development only: files under public/uploads.
 * Uploads are validated by size and by the file's magic bytes, not its name.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";

const MAX_BYTES = 4 * 1024 * 1024; // must stay under next.config bodySizeLimit

function sniff(buf: Uint8Array): "jpg" | "png" | "webp" | null {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  if (String.fromCharCode(...buf.slice(0, 4)) === "RIFF" && String.fromCharCode(...buf.slice(8, 12)) === "WEBP") return "webp";
  return null;
}

export async function storeProductImage(file: File, productSlug: string): Promise<string> {
  if (file.size === 0) throw new Error("Choose an image to upload");
  if (file.size > MAX_BYTES) throw new Error("Images must be 4 MB or smaller");
  const buf = new Uint8Array(await file.arrayBuffer());
  const ext = sniff(buf);
  if (!ext) throw new Error("Only JPEG, PNG or WebP images are accepted");
  const name = `${productSlug}-${randomBytes(6).toString("hex")}.${ext}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const res = await put(`products/${name}`, Buffer.from(buf), {
      access: "public",
      contentType: ext === "jpg" ? "image/jpeg" : `image/${ext}`,
    });
    return res.url;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Image storage isn't configured (set BLOB_READ_WRITE_TOKEN).");
  }
  const dir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), buf);
  return `/uploads/${name}`;
}
