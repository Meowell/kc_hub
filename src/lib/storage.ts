import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";

const allowedImageTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/jpg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

export type UploadedImageFile = {
  type: string;
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

export function isUploadedImageFile(value: unknown): value is UploadedImageFile {
  if (!value || typeof value !== "object") return false;
  const file = value as Partial<UploadedImageFile>;
  return typeof file.type === "string"
    && typeof file.size === "number"
    && typeof file.arrayBuffer === "function";
}

export async function saveUploadedImage(file: UploadedImageFile) {
  const extension = allowedImageTypes.get(file.type);

  if (!extension) {
    throw new Error("仅支持 jpg、jpeg、png、webp、gif 图片");
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

export function isUploadedFileUrl(url: string) {
  return /^\/uploads\/[A-Za-z0-9][A-Za-z0-9._-]*$/.test(url);
}

export async function deleteUploadedFile(url: string) {
  if (!isUploadedFileUrl(url)) return;
  const dir = process.env.UPLOAD_DIR || path.join(process.cwd(), "public", "uploads");
  const baseDir = path.resolve(dir);
  const fullPath = path.resolve(baseDir, url.replace("/uploads/", ""));

  if (!fullPath.startsWith(`${baseDir}${path.sep}`)) return;

  try { await unlink(fullPath); } catch { /* ignore */ }
}
