import { NextRequest, NextResponse } from "next/server";

import { getApiUser, unauthorizedApiResponse } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { parseNoro6Data } from "@/lib/noro6";
import { prisma } from "@/lib/prisma";
import { shipDataSchema } from "@/lib/validators";

export async function GET(request: NextRequest) {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();
  const userId = request.nextUrl.searchParams.get("userId");

  if (userId) {
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { shipData: true, lastShipDataUpdatedAt: true },
    });
    if (!target) return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    return NextResponse.json({
      shipData: target.shipData ?? "",
      lastShipDataUpdatedAt: target.lastShipDataUpdatedAt,
    });
  }

  return NextResponse.json({
    shipData: user.shipData ?? "",
    lastShipDataUpdatedAt: user.lastShipDataUpdatedAt,
  });
}

export async function PUT(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();
  const parsed = shipDataSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "存档内容不能为空，且不能超过 8MB" }, { status: 400 });
  }

  let parsedShipData: ReturnType<typeof parseNoro6Data>;
  try {
    parsedShipData = parseNoro6Data(parsed.data.shipData);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "noro6 存档格式错误" },
      { status: 400 },
    );
  }

  const before = await prisma.user.findUnique({
    where: { id: user.id },
    select: { shipData: true, lastShipDataUpdatedAt: true },
  });
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { shipData: parsed.data.shipData, lastShipDataUpdatedAt: new Date() },
    select: { shipData: true, updatedAt: true, lastShipDataUpdatedAt: true },
  });

  await writeAuditLog({
    actorId: user.id,
    action: "ship_data.update",
    entityType: "User",
    entityId: user.id,
    before: {
      shipDataLength: before?.shipData?.length ?? 0,
      lastShipDataUpdatedAt: before?.lastShipDataUpdatedAt,
    },
    after: {
      shipDataLength: updated.shipData?.length ?? 0,
      lastShipDataUpdatedAt: updated.lastShipDataUpdatedAt,
      shipCount: parsedShipData.ships.length,
      equipmentCount: parsedShipData.items.length,
    },
  });

  return NextResponse.json(updated);
}
