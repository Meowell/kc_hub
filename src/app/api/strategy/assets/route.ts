import { NextResponse } from "next/server";

import { getApiUser, unauthorizedApiResponse } from "@/lib/auth";
import { canEditStrategyPost, isActivityWritable } from "@/lib/collaboration";
import { prisma } from "@/lib/prisma";
import { collectStrategyAssetIds } from "@/lib/strategy-workspace";
import { deleteUploadedFile, isUploadedImageFile, saveUploadedImage } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();

  try {
    const formData = await request.formData();
    const postId = formData.get("postId");
    const file = formData.get("file");
    if (typeof postId !== "string" || !postId || !isUploadedImageFile(file)) {
      return NextResponse.json({ error: "缺少攻略或图片文件" }, { status: 400 });
    }

    const post = await prisma.strategyPost.findUnique({
      where: { id: postId },
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

    const url = await saveUploadedImage(file);
    try {
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
      await deleteUploadedFile(url);
      throw error;
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "上传失败" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const orphanCleanup = searchParams.get("orphan") === "1";
  if (!id) return NextResponse.json({ error: "缺少附件 ID" }, { status: 400 });

  const asset = await prisma.strategyAsset.findUnique({
    where: { id },
    include: {
      strategyPost: {
        include: {
          activity: { select: { status: true, isActive: true } },
          section: { include: { strategyMap: true } },
        },
      },
    },
  });
  if (!asset) return NextResponse.json({ error: "附件不存在" }, { status: 404 });
  if (!canEditStrategyPost(user, asset.strategyPost.userId, asset.strategyPost.sectionId)) return NextResponse.json({ error: "没有删除权限" }, { status: 403 });
  if (orphanCleanup) {
    const referencedIds = collectStrategyAssetIds(asset.strategyPost.content, asset.strategyPost.contentFormat);
    if (referencedIds.includes(asset.id)) return NextResponse.json({ error: "附件仍被攻略引用" }, { status: 409 });
  } else {
    if (!isActivityWritable(asset.strategyPost.activity)) return NextResponse.json({ error: "活动已归档" }, { status: 403 });
    if (asset.strategyPost.section && (asset.strategyPost.section.isDeleted || asset.strategyPost.section.strategyMap.isDeleted || !asset.strategyPost.section.strategyMap.isOpenForPosts)) {
      return NextResponse.json({ error: "该海图尚未开放投稿" }, { status: 403 });
    }
  }
  await prisma.strategyAsset.delete({ where: { id } });
  await deleteUploadedFile(asset.url);
  return NextResponse.json({ ok: true });
}
