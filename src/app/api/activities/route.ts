import { NextResponse } from "next/server";

import { getApiUser, unauthorizedApiResponse } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { canManageSharedResource, getActivityArchiveData } from "@/lib/collaboration";
import { prisma } from "@/lib/prisma";
import { activitySchema } from "@/lib/validators";

export async function GET() {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();

  const activities = await prisma.activity.findMany({
    where: { status: { not: "hidden" } },
    orderBy: [{ isActive: "desc" }, { status: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({ activities });
}

export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();
  if (!canManageSharedResource(user)) {
    return NextResponse.json({ error: "只有规划者或管理员可以管理活动" }, { status: 403 });
  }

  const parsed = activitySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "活动名称不能为空，且不能超过 80 个字符" }, { status: 400 });
  }

  const maxOrder = await prisma.activity.aggregate({ _max: { sortOrder: true } });
  const activity = await prisma.activity.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description || null,
      status: parsed.data.status ?? "active",
      sortOrder: parsed.data.sortOrder ?? (maxOrder._max.sortOrder ?? 0) + 1,
    },
  });

  await writeAuditLog({
    actorId: user.id,
    action: "activity.create",
    entityType: "Activity",
    entityId: activity.id,
    activityId: activity.id,
    after: activity,
  });

  return NextResponse.json({ activity });
}

export async function PATCH(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();
  if (!canManageSharedResource(user)) {
    return NextResponse.json({ error: "只有规划者或管理员可以管理活动" }, { status: 403 });
  }

  const parsed = activitySchema.safeParse(await request.json());
  if (!parsed.success || !parsed.data.id) {
    return NextResponse.json({ error: "缺少活动 ID 或字段不合法" }, { status: 400 });
  }

  const existing = await prisma.activity.findUnique({ where: { id: parsed.data.id } });
  if (!existing) return NextResponse.json({ error: "活动不存在" }, { status: 404 });

  const activity = await prisma.activity.update({
    where: { id: parsed.data.id },
    data: {
      name: parsed.data.name,
      description: parsed.data.description || null,
      ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      ...(parsed.data.sortOrder !== undefined ? { sortOrder: parsed.data.sortOrder } : {}),
    },
  });

  await writeAuditLog({
    actorId: user.id,
    action: activity.status === "archived" && existing.status !== "archived" ? "activity.archive" : "activity.update",
    entityType: "Activity",
    entityId: activity.id,
    activityId: activity.id,
    before: existing,
    after: activity,
  });

  return NextResponse.json({ activity });
}

export async function DELETE(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();
  if (!canManageSharedResource(user)) {
    return NextResponse.json({ error: "只有规划者或管理员可以管理活动" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "缺少活动 ID" }, { status: 400 });

  const existing = await prisma.activity.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "活动不存在" }, { status: 404 });

  const activity = await prisma.activity.update({
    where: { id },
    data: getActivityArchiveData(),
  });

  await writeAuditLog({
    actorId: user.id,
    action: "activity.archive",
    entityType: "Activity",
    entityId: activity.id,
    activityId: activity.id,
    before: existing,
    after: activity,
  });

  return NextResponse.json({ ok: true });
}
