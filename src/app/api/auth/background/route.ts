import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/auth";
import { deleteUploadedFile, isUploadedFileUrl } from "@/lib/storage";

export async function PATCH(request: Request) {
  const user = await requireApiUser();

  const { backgroundUrl } = (await request.json()) as { backgroundUrl?: string | null };

  if (backgroundUrl !== undefined && backgroundUrl !== null && typeof backgroundUrl !== "string") {
    return NextResponse.json({ error: "backgroundUrl 必须是字符串" }, { status: 400 });
  }

  if (backgroundUrl && !isUploadedFileUrl(backgroundUrl)) {
    return NextResponse.json({ error: "背景地址必须来自本地上传" }, { status: 400 });
  }

  // 删旧背景文件
  if (user.backgroundUrl) {
    await deleteUploadedFile(user.backgroundUrl);
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { backgroundUrl: backgroundUrl ?? null },
    select: { id: true, name: true, avatarUrl: true, backgroundUrl: true },
  });

  return NextResponse.json({ user: updated });
}
