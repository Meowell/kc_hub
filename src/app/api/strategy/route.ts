import { NextResponse } from "next/server";

import { normalizeActivityId } from "@/lib/activity-scope";
import { writeAuditLog } from "@/lib/audit";
import { getApiUser, unauthorizedApiResponse } from "@/lib/auth";
import { canEditStrategyPost, isActivityWritable } from "@/lib/collaboration";
import { prisma } from "@/lib/prisma";
import {
  EMPTY_STRATEGY_DOCUMENT,
  STRATEGY_CONTENT_FORMAT,
  STRATEGY_DRAFT,
  STRATEGY_PUBLISHED,
  collectStrategyAssetIds,
  extractStrategyContentPlainText,
  isValidStrategyDocument,
} from "@/lib/strategy-workspace";
import { deleteUploadedFile } from "@/lib/storage";
import { strategyPostSchema } from "@/lib/validators";

const postInclude = {
  user: { select: { id: true, name: true, avatarUrl: true } },
  section: {
    include: {
      strategyMap: true,
      lockTags: { orderBy: { sortOrder: "asc" as const }, include: { lockTag: true } },
    },
  },
};

function strategyRequiresActivityResponse() {
  return NextResponse.json({ error: "攻略需要选择活动，日常仅支持作业卡" }, { status: 400 });
}

export async function GET(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();
  const { searchParams } = new URL(request.url);
  const activityId = normalizeActivityId(searchParams.get("activityId"));
  const id = searchParams.get("id");

  if (id) {
    const post = await prisma.strategyPost.findUnique({ where: { id }, include: postInclude });
    if (!post || !post.activityId || post.isDeleted || (post.status === STRATEGY_DRAFT && post.userId !== user.id)) {
      return NextResponse.json({ error: "攻略不存在" }, { status: 404 });
    }
    return NextResponse.json({ post });
  }

  if (!activityId) return strategyRequiresActivityResponse();

  const posts = await prisma.strategyPost.findMany({
    where: {
      activityId,
      isDeleted: false,
      OR: [{ status: STRATEGY_PUBLISHED }, { userId: user.id }],
    },
    orderBy: [{ isPinned: "desc" }, { phaseName: "asc" }, { updatedAt: "desc" }],
    include: postInclude,
  });
  return NextResponse.json({ posts });
}

export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();
  const parsed = strategyPostSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "攻略字段不完整" }, { status: 400 });
  if (parsed.data.contentFormat === STRATEGY_CONTENT_FORMAT && !isValidStrategyDocument(parsed.data.content)) {
    return NextResponse.json({ error: "攻略文档结构无效" }, { status: 400 });
  }

  if (parsed.data.sectionId) {
    const section = await prisma.strategySection.findUnique({
      where: { id: parsed.data.sectionId },
      include: { strategyMap: { include: { activity: { select: { status: true, isActive: true } } } } },
    });
    if (!section || section.isDeleted || section.strategyMap.isDeleted) {
      return NextResponse.json({ error: "攻略分块不存在" }, { status: 404 });
    }
    if (!section.strategyMap.isOpenForPosts) {
      return NextResponse.json({ error: "该海图仍在整理中，暂未开放投稿" }, { status: 403 });
    }
    if (!isActivityWritable(section.strategyMap.activity)) {
      return NextResponse.json({ error: "活动已归档，攻略只读" }, { status: 403 });
    }

    const content = parsed.data.content || JSON.stringify(EMPTY_STRATEGY_DOCUMENT);
    const plainText = extractStrategyContentPlainText(content, parsed.data.contentFormat);
    const existing = await prisma.strategyPost.findUnique({
      where: { sectionId_userId: { sectionId: section.id, userId: user.id } },
    });
    if (existing && !existing.isDeleted) {
      return NextResponse.json({ error: "你在该分块已经有一篇个人攻略", postId: existing.id }, { status: 409 });
    }
    const staleAssets = existing
      ? await prisma.strategyAsset.findMany({ where: { strategyPostId: existing.id }, select: { url: true } })
      : [];
    const post = existing
      ? await prisma.$transaction(async (tx) => {
        await tx.strategyAsset.deleteMany({ where: { strategyPostId: existing.id } });
        await tx.strategyRevision.deleteMany({ where: { strategyPostId: existing.id } });
        return tx.strategyPost.update({
          where: { id: existing.id },
          data: {
            activityId: section.strategyMap.activityId,
            phaseName: section.strategyMap.code,
            title: `${section.strategyMap.code} ${section.name}`,
            content,
            contentFormat: parsed.data.contentFormat,
            plainText,
            status: STRATEGY_DRAFT,
            publishedAt: null,
            isDeleted: false,
            isPinned: false,
            fleetImageUrl: null,
            airbaseImageUrl: null,
            routineCardIds: null,
            revision: 1,
            updatedById: user.id,
          },
          include: postInclude,
        });
      })
      : await prisma.strategyPost.create({
        data: {
          userId: user.id,
          activityId: section.strategyMap.activityId,
          sectionId: section.id,
          phaseName: section.strategyMap.code,
          title: `${section.strategyMap.code} ${section.name}`,
          content,
          contentFormat: parsed.data.contentFormat || STRATEGY_CONTENT_FORMAT,
          plainText,
          status: STRATEGY_DRAFT,
          updatedById: user.id,
        },
        include: postInclude,
      });

    await Promise.all(staleAssets.map((asset) => deleteUploadedFile(asset.url)));

    await writeAuditLog({ actorId: user.id, action: "strategy.create_draft", entityType: "StrategyPost", entityId: post.id, activityId: post.activityId, after: { id: post.id, sectionId: post.sectionId } });
    return NextResponse.json({ post });
  }

  if (!parsed.data.phaseName.trim() || !parsed.data.title.trim()) {
    return NextResponse.json({ error: "旧版攻略需要阶段和标题" }, { status: 400 });
  }
  const activityId = normalizeActivityId(parsed.data.activityId);
  if (!activityId) return strategyRequiresActivityResponse();
  const activity = activityId
    ? await prisma.activity.findUnique({ where: { id: activityId }, select: { status: true, isActive: true } })
    : null;
  if (!activity) return NextResponse.json({ error: "活动不存在" }, { status: 404 });
  if (!isActivityWritable(activity)) return NextResponse.json({ error: "活动已归档，攻略只读" }, { status: 403 });

  const post = await prisma.strategyPost.create({
    data: {
      userId: user.id,
      activityId,
      phaseName: parsed.data.phaseName,
      title: parsed.data.title,
      content: parsed.data.content,
      contentFormat: parsed.data.contentFormat,
      plainText: extractStrategyContentPlainText(parsed.data.content, parsed.data.contentFormat),
      status: parsed.data.status ?? STRATEGY_PUBLISHED,
      publishedAt: parsed.data.status === STRATEGY_DRAFT ? null : new Date(),
      fleetImageUrl: parsed.data.fleetImageUrl || null,
      airbaseImageUrl: parsed.data.airbaseImageUrl || null,
      routineCardIds: parsed.data.routineCardIds || null,
      isPinned: parsed.data.isPinned ?? false,
      updatedById: user.id,
    },
    include: postInclude,
  });
  await writeAuditLog({ actorId: user.id, action: "strategy.create", entityType: "StrategyPost", entityId: post.id, activityId: post.activityId, after: post });
  return NextResponse.json({ post });
}

export async function PATCH(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();
  const parsed = strategyPostSchema.safeParse(await request.json());
  if (!parsed.success || !parsed.data.id) return NextResponse.json({ error: "缺少攻略 ID" }, { status: 400 });
  if (parsed.data.contentFormat === STRATEGY_CONTENT_FORMAT && !isValidStrategyDocument(parsed.data.content)) {
    return NextResponse.json({ error: "攻略文档结构无效" }, { status: 400 });
  }

  const existing = await prisma.strategyPost.findUnique({
    where: { id: parsed.data.id },
    include: {
      activity: { select: { status: true, isActive: true } },
      section: { include: { strategyMap: true } },
    },
  });
  if (!existing || existing.isDeleted) return NextResponse.json({ error: "攻略不存在" }, { status: 404 });
  if (!existing.activityId) return strategyRequiresActivityResponse();
  if (!canEditStrategyPost(user, existing.userId, existing.sectionId)) return NextResponse.json({ error: "没有编辑权限" }, { status: 403 });
  if (!isActivityWritable(existing.activity)) return NextResponse.json({ error: "活动已归档，攻略只读" }, { status: 403 });
  if (existing.section && (existing.section.isDeleted || existing.section.strategyMap.isDeleted || !existing.section.strategyMap.isOpenForPosts)) {
    return NextResponse.json({ error: "该海图仍在整理中，攻略当前只读" }, { status: 403 });
  }
  if (parsed.data.revision !== undefined && parsed.data.revision !== existing.revision) {
    return NextResponse.json({ error: "攻略已被其他编辑更新", currentRevision: existing.revision }, { status: 409 });
  }

  const publishing = parsed.data.status === STRATEGY_PUBLISHED && existing.status !== STRATEGY_PUBLISHED;
  const referencedAssetIds = collectStrategyAssetIds(parsed.data.content, parsed.data.contentFormat);
  const result = await prisma.$transaction(async (tx) => {
    await tx.strategyRevision.upsert({
      where: { strategyPostId_revision: { strategyPostId: existing.id, revision: existing.revision } },
      update: {},
      create: {
        strategyPostId: existing.id,
        createdById: user.id,
        revision: existing.revision,
        content: existing.content,
        contentFormat: existing.contentFormat,
      },
    });
    const post = await tx.strategyPost.update({
      where: { id: existing.id },
      data: {
        phaseName: existing.section?.strategyMap.code ?? parsed.data.phaseName,
        title: existing.section ? `${existing.section.strategyMap.code} ${existing.section.name}` : parsed.data.title,
        content: parsed.data.content,
        contentFormat: parsed.data.contentFormat,
        plainText: extractStrategyContentPlainText(parsed.data.content, parsed.data.contentFormat),
        revision: { increment: 1 },
        status: publishing ? STRATEGY_PUBLISHED : existing.status,
        ...(publishing ? { publishedAt: new Date() } : {}),
        updatedById: user.id,
        ...(parsed.data.isPinned !== undefined ? { isPinned: parsed.data.isPinned } : {}),
      },
      include: postInclude,
    });
    const staleAssets = await tx.strategyAsset.findMany({
      where: {
        strategyPostId: existing.id,
        ...(referencedAssetIds.length ? { id: { notIn: referencedAssetIds } } : {}),
      },
      select: { id: true, url: true },
    });
    if (staleAssets.length) {
      await tx.strategyAsset.deleteMany({ where: { id: { in: staleAssets.map((asset) => asset.id) } } });
    }
    const stale = await tx.strategyRevision.findMany({
      where: { strategyPostId: existing.id },
      orderBy: { revision: "desc" },
      skip: 20,
      select: { id: true },
    });
    if (stale.length) await tx.strategyRevision.deleteMany({ where: { id: { in: stale.map((entry) => entry.id) } } });
    return { post, staleAssets };
  });
  const updated = result.post;
  await Promise.all(result.staleAssets.map((asset) => deleteUploadedFile(asset.url)));

  if (publishing) {
    await writeAuditLog({ actorId: user.id, action: "strategy.publish", entityType: "StrategyPost", entityId: updated.id, activityId: updated.activityId, before: { status: existing.status }, after: { status: updated.status, revision: updated.revision } });
  }
  return NextResponse.json({ post: updated });
}

export async function DELETE(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "缺少攻略 ID" }, { status: 400 });
  const existing = await prisma.strategyPost.findUnique({
    where: { id },
    include: {
      activity: { select: { status: true, isActive: true } },
      assets: true,
      section: { include: { strategyMap: true } },
    },
  });
  if (!existing || existing.isDeleted) return NextResponse.json({ error: "攻略不存在" }, { status: 404 });
  if (!existing.activityId) return strategyRequiresActivityResponse();
  if (!canEditStrategyPost(user, existing.userId, existing.sectionId)) return NextResponse.json({ error: "没有删除权限" }, { status: 403 });
  if (!isActivityWritable(existing.activity)) return NextResponse.json({ error: "活动已归档，攻略只读" }, { status: 403 });
  if (existing.section && (existing.section.isDeleted || existing.section.strategyMap.isDeleted || !existing.section.strategyMap.isOpenForPosts)) {
    return NextResponse.json({ error: "该海图仍在整理中，攻略当前只读" }, { status: 403 });
  }

  const post = await prisma.$transaction(async (tx) => {
    await tx.strategyAsset.deleteMany({ where: { strategyPostId: id } });
    return tx.strategyPost.update({ where: { id }, data: { isDeleted: true, updatedById: user.id } });
  });
  await Promise.all(existing.assets.map((asset) => deleteUploadedFile(asset.url)));
  await writeAuditLog({ actorId: user.id, action: "strategy.delete", entityType: "StrategyPost", entityId: post.id, activityId: post.activityId, before: existing, after: post });
  return NextResponse.json({ ok: true });
}
