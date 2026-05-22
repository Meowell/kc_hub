import { NextResponse } from "next/server";

import { getApiUser, unauthorizedApiResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { routineRecordSchema } from "@/lib/validators";

export async function GET(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();
  const { searchParams } = new URL(request.url);
  const seaArea = searchParams.get("seaArea") ?? undefined;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") ?? "10", 10) || 10));

  const where = { userId: user.id, ...(seaArea ? { seaArea } : {}) };

  const [records, totalCount] = await Promise.all([
    prisma.routineRecord.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
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

  const record = await prisma.routineRecord.create({
    data: {
      userId: user.id,
      seaArea: parsed.data.seaArea,
      missionName: parsed.data.missionName,
      airControl: parsed.data.airControl,
      note: parsed.data.note || null,
      imageUrl: parsed.data.imageUrl || null,
      fleetData: parsed.data.fleetData || null,
    },
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

  const record = await prisma.routineRecord.update({
    where: { id: parsed.data.id, userId: user.id },
    data: {
      seaArea: parsed.data.seaArea,
      missionName: parsed.data.missionName,
      airControl: parsed.data.airControl,
      note: parsed.data.note || null,
      imageUrl: parsed.data.imageUrl || null,
      fleetData: parsed.data.fleetData !== undefined ? parsed.data.fleetData : undefined,
    },
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

  await prisma.routineRecord.delete({
    where: { id, userId: user.id },
  });

  return NextResponse.json({ ok: true });
}
