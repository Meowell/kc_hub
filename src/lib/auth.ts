import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export async function getCurrentUser() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);

  if (!session) {
    return null;
  }

  return prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      name: true,
      role: true,
      avatarUrl: true,
      backgroundUrl: true,
      shipData: true,
      lastShipDataUpdatedAt: true,
      food: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function getApiUser() {
  return getCurrentUser();
}

export function unauthorizedApiResponse() {
  return NextResponse.json({ error: "请先登录" }, { status: 401 });
}
