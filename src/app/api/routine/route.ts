import { NextResponse } from "next/server";

import { getApiUser, unauthorizedApiResponse } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { canEditOwnedResource, getVisibleContentWhere, isActivityWritable } from "@/lib/collaboration";
import { normalizeActivityId } from "@/lib/activity-scope";
import { prisma } from "@/lib/prisma";
import { routineRecordSchema } from "@/lib/validators";

export async function GET(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const seaArea = searchParams.get("seaArea") ?? undefined;
  const activityId = normalizeActivityId(searchParams.get("activityId"));
  const forStrategy = searchParams.get("forStrategy") === "1";
  const query = searchParams.get("q")?.trim() ?? "";
  const uploaderId = searchParams.get("uploaderId")?.trim() ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") ?? "10", 10) || 10));

  if (id && forStrategy) {
    const record = await prisma.routineRecord.findFirst({
      where: { id, isDeleted: false },
      include: { user: { select: { id: true, name: true } } },
    });
    if (!record) return NextResponse.json({ error: "作业卡不存在" }, { status: 404 });
    return NextResponse.json({ record });
  }

  const where = getVisibleContentWhere({
    ...(!forStrategy ? { userId: user.id } : {}),
    activityId,
    ...(seaArea ? { seaArea } : {}),
    ...(uploaderId ? { userId: uploaderId } : {}),
    ...(query ? {
      OR: [
        { seaArea: { contains: query } },
        { missionName: { contains: query } },
        { user: { name: { contains: query } } },
      ],
    } : {}),
  });

  const [records, totalCount] = await Promise.all([
    prisma.routineRecord.findMany({
      where,
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      ...(forStrategy ? { include: { user: { select: { id: true, name: true } } } } : {}),
    }),
    prisma.routineRecord.count({ where }),
  ]);

  return NextResponse.json({
    records,
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
    },
  });
}

export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();
  const parsed = routineRecordSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "周回记录字段不完整" }, { status: 400 });
  }

  const activityId = normalizeActivityId(parsed.data.activityId);
  const activity = activityId
    ? await prisma.activity.findUnique({ where: { id: activityId }, select: { status: true, isActive: true } })
    : null;
  if (activityId && !activity) return NextResponse.json({ error: "活动不存在" }, { status: 404 });
  if (!isActivityWritable(activity)) {
    return NextResponse.json({ error: "活动已归档，作业卡只读" }, { status: 403 });
  }

  const record = await prisma.routineRecord.create({
    data: {
      userId: user.id,
      activityId,
      seaArea: parsed.data.seaArea,
      missionName: parsed.data.missionName,
      airControl: parsed.data.airControl,
      note: parsed.data.note || null,
      imageUrl: parsed.data.imageUrl || null,
      fleetData: parsed.data.fleetData || null,
      isPinned: parsed.data.isPinned ?? false,
      copiedFromId: parsed.data.copiedFromId || null,
    },
  });

  await writeAuditLog({
    actorId: user.id,
    action: "routine.create",
    entityType: "RoutineRecord",
    entityId: record.id,
    activityId: record.activityId,
    after: record,
  });

  return NextResponse.json({ record });
}

export async function PATCH(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();
  const parsed = routineRecordSchema.safeParse(await request.json());

  if (!parsed.success || !parsed.data.id) {
    return NextResponse.json({ error: "缺少记录 ID" }, { status: 400 });
  }

  const existing = await prisma.routineRecord.findUnique({
    where: { id: parsed.data.id },
    include: { activity: { select: { status: true, isActive: true } } },
  });
  if (!existing || existing.isDeleted) return NextResponse.json({ error: "作业卡不存在" }, { status: 404 });
  if (!canEditOwnedResource(user, existing.userId)) {
    return NextResponse.json({ error: "只能编辑自己的作业卡，或由规划者/管理员编辑" }, { status: 403 });
  }
  if (!isActivityWritable(existing.activity)) {
    return NextResponse.json({ error: "活动已归档，作业卡只读" }, { status: 403 });
  }

  const targetActivityId = normalizeActivityId(parsed.data.activityId);
  if (targetActivityId !== existing.activityId) {
    const targetActivity = targetActivityId
      ? await prisma.activity.findUnique({ where: { id: targetActivityId }, select: { status: true, isActive: true } })
      : null;
    if (targetActivityId && !targetActivity) return NextResponse.json({ error: "活动不存在" }, { status: 404 });
    if (!isActivityWritable(targetActivity)) {
      return NextResponse.json({ error: "目标活动已归档，作业卡只读" }, { status: 403 });
    }
  }

  const record = await prisma.routineRecord.update({
    where: { id: parsed.data.id },
    data: {
      seaArea: parsed.data.seaArea,
      activityId: targetActivityId,
      missionName: parsed.data.missionName,
      airControl: parsed.data.airControl,
      note: parsed.data.note || null,
      imageUrl: parsed.data.imageUrl || null,
      fleetData: parsed.data.fleetData !== undefined ? parsed.data.fleetData : undefined,
      ...(parsed.data.isPinned !== undefined ? { isPinned: parsed.data.isPinned } : {}),
    },
  });

  await writeAuditLog({
    actorId: user.id,
    action: "routine.update",
    entityType: "RoutineRecord",
    entityId: record.id,
    activityId: record.activityId,
    before: existing,
    after: record,
  });

  return NextResponse.json({ record });
}

export async function DELETE(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "缺少记录 ID" }, { status: 400 });
  }

  const existing = await prisma.routineRecord.findUnique({
    where: { id },
    include: { activity: { select: { status: true, isActive: true } } },
  });
  if (!existing || existing.isDeleted) return NextResponse.json({ error: "作业卡不存在" }, { status: 404 });
  if (!canEditOwnedResource(user, existing.userId)) {
    return NextResponse.json({ error: "只能删除自己的作业卡，或由规划者/管理员删除" }, { status: 403 });
  }
  if (!isActivityWritable(existing.activity)) {
    return NextResponse.json({ error: "活动已归档，作业卡只读" }, { status: 403 });
  }

  const record = await prisma.routineRecord.update({
    where: { id },
    data: { isDeleted: true },
  });

  await writeAuditLog({
    actorId: user.id,
    action: "routine.delete",
    entityType: "RoutineRecord",
    entityId: record.id,
    activityId: record.activityId,
    before: existing,
    after: record,
  });

  return NextResponse.json({ ok: true });
}
