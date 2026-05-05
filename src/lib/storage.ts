import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";

const allowedImageTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

export async function saveUploadedImage(file: File) {
  const extension = allowedImageTypes.get(file.type);

  if (!extension) {
    throw new Error("仅支持 jpg、png、webp、gif 图片");
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error("单张图片不能超过 10MB");
  }

  const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadDir, { recursive: true });

  const fileName = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const fullPath = path.join(uploadDir, fileName);
  const buffer = Buffer.from(await file.arrayBuffer());

  await writeFile(fullPath, buffer);

  return `/uploads/${fileName}`;
}

export async function deleteUploadedFile(url: string) {
  if (!url || !url.startsWith("/uploads/")) return;
  const dir = process.env.UPLOAD_DIR || path.join(process.cwd(), "public", "uploads");
  try { await unlink(path.join(dir, url.replace("/uploads/", ""))); } catch { /* ignore */ }
}
