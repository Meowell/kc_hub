import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export async function getCurrentUser() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);

  console.log("[auth] getCurrentUser:", "hasCookie:", !!token, "hasSession:", !!session);

  if (!session) {
    return null;
  }

  return prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      backgroundUrl: true,
      shipData: true,
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

export async function requireApiUser() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Response(JSON.stringify({ error: "请先登录" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  return user;
}
