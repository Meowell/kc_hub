import { NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/audit";
import { getApiUser, unauthorizedApiResponse } from "@/lib/auth";
import { canManageSharedResource, isActivityWritable } from "@/lib/collaboration";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();
  if (!canManageSharedResource(user)) {
    return NextResponse.json({ error: "只有规划者或管理员可以移动旧攻略" }, { status: 403 });
  }

  const body = await request.json() as { postId?: string; sectionId?: string };
  if (!body.postId || !body.sectionId) {
    return NextResponse.json({ error: "缺少攻略或分块 ID" }, { status: 400 });
  }
  const [post, section] = await Promise.all([
    prisma.strategyPost.findUnique({ where: { id: body.postId } }),
    prisma.strategySection.findUnique({
      where: { id: body.sectionId },
      include: { strategyMap: { include: { activity: { select: { status: true, isActive: true } } } } },
    }),
  ]);
  if (!post || post.isDeleted || post.sectionId) {
    return NextResponse.json({ error: "只能移动未分块的有效攻略" }, { status: 404 });
  }
  if (!section || section.isDeleted || section.strategyMap.isDeleted) {
    return NextResponse.json({ error: "目标分块不存在" }, { status: 404 });
  }
  if (post.activityId !== section.strategyMap.activityId) {
    return NextResponse.json({ error: "不能跨活动移动攻略" }, { status: 400 });
  }
  if (!isActivityWritable(section.strategyMap.activity)) {
    return NextResponse.json({ error: "活动已归档" }, { status: 403 });
  }
  const conflict = await prisma.strategyPost.findUnique({
    where: { sectionId_userId: { sectionId: section.id, userId: post.userId } },
  });
  if (conflict && conflict.id !== post.id) {
    return NextResponse.json({ error: "该作者在目标分块已有个人攻略" }, { status: 409 });
  }

  const updated = await prisma.strategyPost.update({
    where: { id: post.id },
    data: {
      sectionId: section.id,
      phaseName: section.strategyMap.code,
      title: `${section.strategyMap.code} ${section.name}`,
      updatedById: user.id,
    },
  });
  await writeAuditLog({
    actorId: user.id,
    action: "strategy.move_to_section",
    entityType: "StrategyPost",
    entityId: updated.id,
    activityId: updated.activityId,
    before: { sectionId: null, phaseName: post.phaseName, title: post.title },
    after: { sectionId: updated.sectionId, phaseName: updated.phaseName, title: updated.title },
  });
  return NextResponse.json({ post: updated });
}
