import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { isUploadedImageFile, saveUploadedImage, type UploadedImageFile } from "./storage";

function createImageFile(type: string, bytes: number[]): UploadedImageFile {
  const contents = Uint8Array.from(bytes);
  return {
    type,
    size: contents.byteLength,
    arrayBuffer: async () => contents.buffer.slice(0) as ArrayBuffer,
  };
}

describe("image storage", () => {
  it("recognizes multipart file objects without using the global File constructor", () => {
    assert.equal(isUploadedImageFile(createImageFile("image/jpeg", [0xff, 0xd8, 0xff, 0xd9])), true);
    assert.equal(isUploadedImageFile("not-a-file"), false);
    assert.equal(isUploadedImageFile(null), false);
  });

  it("stores jpeg MIME variants as jpg files", async () => {
    const uploadDir = await mkdtemp(path.join(os.tmpdir(), "kancolle-upload-"));
    const previousUploadDir = process.env.UPLOAD_DIR;

    try {
      process.env.UPLOAD_DIR = uploadDir;
      for (const type of ["image/jpeg", "image/jpg"]) {
        const imageUrl = await saveUploadedImage(createImageFile(type, [0xff, 0xd8, 0xff, 0xd9]));
        assert.match(imageUrl, /^\/uploads\/[A-Za-z0-9._-]+\.jpg$/);
        const stored = await readFile(path.join(uploadDir, path.basename(imageUrl)));
        assert.deepEqual([...stored], [0xff, 0xd8, 0xff, 0xd9]);
      }
    } finally {
      if (previousUploadDir === undefined) delete process.env.UPLOAD_DIR;
      else process.env.UPLOAD_DIR = previousUploadDir;
      await rm(uploadDir, { recursive: true, force: true });
    }
  });
});
