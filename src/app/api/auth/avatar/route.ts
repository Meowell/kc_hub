import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiUser, unauthorizedApiResponse } from "@/lib/auth";
import { isUploadedFileUrl } from "@/lib/storage";

export async function PATCH(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();

  const { avatarUrl } = (await request.json()) as { avatarUrl?: string | null };

  if (avatarUrl !== undefined && avatarUrl !== null && typeof avatarUrl !== "string") {
    return NextResponse.json({ error: "avatarUrl 必须是字符串" }, { status: 400 });
  }

  if (avatarUrl && !isUploadedFileUrl(avatarUrl)) {
    return NextResponse.json({ error: "头像地址必须来自本地上传" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { avatarUrl: avatarUrl ?? null },
    select: { id: true, name: true, avatarUrl: true },
  });

  return NextResponse.json({ user: updated });
}
