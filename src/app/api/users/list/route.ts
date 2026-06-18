import { NextResponse } from "next/server";
import { getApiUser, unauthorizedApiResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();

  const users = await prisma.user.findMany({
    where: {
      id: { not: user.id },
      AND: [{ shipData: { not: null } }, { shipData: { not: "" } }],
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(users);
}
