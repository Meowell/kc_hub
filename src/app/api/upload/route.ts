import { NextResponse } from "next/server";

import { getApiUser, unauthorizedApiResponse } from "@/lib/auth";
import { isUploadedImageFile, saveUploadedImage } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!isUploadedImageFile(file)) {
      return NextResponse.json({ error: "请上传图片文件" }, { status: 400 });
    }

    const imageUrl = await saveUploadedImage(file);
    return NextResponse.json({ imageUrl });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "上传失败" },
      { status: 400 },
    );
  }
}
