type UploadResponse = {
  imageUrl?: unknown;
  error?: unknown;
};

export async function uploadImage(file: File) {
  const data = new FormData();
  data.append("file", file);

  const response = await fetch("/api/upload", { method: "POST", body: data });
  const payload = await response.json().catch(() => null) as UploadResponse | null;

  if (!response.ok) {
    const message = typeof payload?.error === "string"
      ? payload.error
      : `上传失败（HTTP ${response.status}）`;
    throw new Error(message);
  }

  if (typeof payload?.imageUrl !== "string") {
    throw new Error("上传接口返回异常");
  }

  return payload.imageUrl;
}
