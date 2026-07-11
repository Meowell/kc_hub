import { NextResponse } from "next/server";

import { getApiUser, unauthorizedApiResponse } from "@/lib/auth";
import { canEditStrategyPost, isActivityWritable } from "@/lib/collaboration";
import { prisma } from "@/lib/prisma";
import { collectStrategyAssetIds, extractStrategyContentPlainText } from "@/lib/strategy-workspace";
import { deleteUploadedFile } from "@/lib/storage";

export async function GET(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();
  const postId = new URL(request.url).searchParams.get("postId");
  if (!postId) return NextResponse.json({ error: "缺少攻略 ID" }, { status: 400 });
  const post = await prisma.strategyPost.findUnique({ where: { id: postId } });
  if (!post || post.isDeleted) return NextResponse.json({ error: "攻略不存在" }, { status: 404 });
  if (!canEditStrategyPost(user, post.userId, post.sectionId)) return NextResponse.json({ error: "没有查看历史权限" }, { status: 403 });
  const revisions = await prisma.strategyRevision.findMany({
    where: { strategyPostId: postId },
    orderBy: { revision: "desc" },
    take: 20,
    include: { createdBy: { select: { id: true, name: true } } },
  });
  return NextResponse.json({ revisions });
}

export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();
  const body = await request.json() as { postId?: string; revisionId?: string; currentRevision?: number };
  if (!body.postId || !body.revisionId || !body.currentRevision) {
    return NextResponse.json({ error: "缺少历史版本参数" }, { status: 400 });
  }
  const [post, revision] = await Promise.all([
    prisma.strategyPost.findUnique({
      where: { id: body.postId },
      include: {
        activity: { select: { status: true, isActive: true } },
        section: { include: { strategyMap: true } },
      },
    }),
    prisma.strategyRevision.findUnique({ where: { id: body.revisionId } }),
  ]);
  if (!post || !revision || revision.strategyPostId !== post.id) return NextResponse.json({ error: "历史版本不存在" }, { status: 404 });
  if (!canEditStrategyPost(user, post.userId, post.sectionId)) return NextResponse.json({ error: "没有恢复权限" }, { status: 403 });
  if (!isActivityWritable(post.activity)) return NextResponse.json({ error: "活动已归档" }, { status: 403 });
  if (post.section && (post.section.isDeleted || post.section.strategyMap.isDeleted || !post.section.strategyMap.isOpenForPosts)) {
    return NextResponse.json({ error: "该海图仍在整理中，攻略当前只读" }, { status: 403 });
  }
  if (post.revision !== body.currentRevision) return NextResponse.json({ error: "攻略已更新，请刷新后重试", currentRevision: post.revision }, { status: 409 });

  const referencedAssetIds = collectStrategyAssetIds(revision.content, revision.contentFormat);
  const result = await prisma.$transaction(async (tx) => {
    await tx.strategyRevision.upsert({
      where: { strategyPostId_revision: { strategyPostId: post.id, revision: post.revision } },
      update: {},
      create: { strategyPostId: post.id, createdById: user.id, revision: post.revision, content: post.content, contentFormat: post.contentFormat },
    });
    const updated = await tx.strategyPost.update({
      where: { id: post.id },
      data: {
        content: revision.content,
        contentFormat: revision.contentFormat,
        plainText: extractStrategyContentPlainText(revision.content, revision.contentFormat),
        revision: { increment: 1 },
        updatedById: user.id,
      },
    });
    const staleAssets = await tx.strategyAsset.findMany({
      where: {
        strategyPostId: post.id,
        ...(referencedAssetIds.length ? { id: { notIn: referencedAssetIds } } : {}),
      },
      select: { id: true, url: true },
    });
    if (staleAssets.length) await tx.strategyAsset.deleteMany({ where: { id: { in: staleAssets.map((asset) => asset.id) } } });
    const staleRevisions = await tx.strategyRevision.findMany({
      where: { strategyPostId: post.id },
      orderBy: { revision: "desc" },
      skip: 20,
      select: { id: true },
    });
    if (staleRevisions.length) await tx.strategyRevision.deleteMany({ where: { id: { in: staleRevisions.map((entry) => entry.id) } } });
    return { updated, staleAssets };
  });
  await Promise.all(result.staleAssets.map((asset) => deleteUploadedFile(asset.url)));
  return NextResponse.json({ post: result.updated });
}
