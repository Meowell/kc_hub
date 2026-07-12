import { NextResponse } from "next/server";

import { getApiUser, unauthorizedApiResponse } from "@/lib/auth";
import { canEditStrategyPost, isActivityWritable } from "@/lib/collaboration";
import { prisma } from "@/lib/prisma";
import { fetchRemoteImage } from "@/lib/remote-image";
import { deleteUploadedFile, saveUploadedImage } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();
  const body = await request.json().catch(() => ({})) as { postId?: unknown; url?: unknown };
  if (typeof body.postId !== "string" || !body.postId || typeof body.url !== "string" || !body.url) {
    return NextResponse.json({ error: "缺少攻略或外部图片地址" }, { status: 400 });
  }

  const post = await prisma.strategyPost.findUnique({
    where: { id: body.postId },
    include: {
      activity: { select: { status: true, isActive: true } },
      section: { include: { strategyMap: true } },
    },
  });
  if (!post || post.isDeleted) return NextResponse.json({ error: "攻略不存在" }, { status: 404 });
  if (!canEditStrategyPost(user, post.userId, post.sectionId)) return NextResponse.json({ error: "没有上传权限" }, { status: 403 });
  if (!isActivityWritable(post.activity)) return NextResponse.json({ error: "活动已归档" }, { status: 403 });
  if (post.section && (post.section.isDeleted || post.section.strategyMap.isDeleted || !post.section.strategyMap.isOpenForPosts)) {
    return NextResponse.json({ error: "该海图尚未开放投稿" }, { status: 403 });
  }

  let url = "";
  try {
    const file = await fetchRemoteImage(body.url);
    url = await saveUploadedImage(file);
    const asset = await prisma.strategyAsset.create({
      data: {
        strategyPostId: post.id,
        userId: user.id,
        url,
        mimeType: file.type,
        size: file.size,
      },
    });
    return NextResponse.json({ asset });
  } catch (error) {
    if (url) await deleteUploadedFile(url);
    return NextResponse.json({ error: error instanceof Error ? error.message : "外部图片转存失败" }, { status: 400 });
  }
}
