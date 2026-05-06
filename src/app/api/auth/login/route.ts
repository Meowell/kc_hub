import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/session";
import { loginSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "请输入用户名和 4 位 PIN" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { name: parsed.data.name.trim() },
  });

  if (!user) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }

  const isValid = await bcrypt.compare(parsed.data.pinCode, user.pinCode);

  if (!isValid) {
    return NextResponse.json({ error: "PIN 不正确" }, { status: 401 });
  }

  const token = await createSessionToken({ userId: user.id, name: user.name });
  const response = NextResponse.json({ user: { id: user.id, name: user.name } });

  const isSecure =
    request.url.startsWith("https:") ||
    request.headers.get("x-forwarded-proto") === "https";

  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecure,
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });

  return response;
}
