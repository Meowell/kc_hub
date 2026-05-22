import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { clearRateLimit, checkRateLimit } from "@/lib/rate-limit";
import { createSessionToken, SESSION_COOKIE, SESSION_COOKIE_SECURE, SESSION_MAX_AGE } from "@/lib/session";
import { loginSchema } from "@/lib/validators";

const LOGIN_ERROR = "用户名或 PIN 不正确";

function getClientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "请输入用户名和 4 位 PIN" }, { status: 400 });
  }

  const name = parsed.data.name.trim();
  const rateLimitKey = `login:${getClientIp(request)}:${name.toLowerCase()}`;
  const rateLimit = checkRateLimit(rateLimitKey, { limit: 8, windowMs: 10 * 60 * 1000 });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "登录尝试过多，请稍后再试" },
      { status: 429, headers: { "retry-after": String(rateLimit.retryAfterSeconds) } },
    );
  }

  const user = await prisma.user.findUnique({
    where: { name },
  });

  if (!user) {
    return NextResponse.json({ error: LOGIN_ERROR }, { status: 401 });
  }

  const isValid = await bcrypt.compare(parsed.data.pinCode, user.pinCode);

  if (!isValid) {
    return NextResponse.json({ error: LOGIN_ERROR }, { status: 401 });
  }

  clearRateLimit(rateLimitKey);
  const token = await createSessionToken({ userId: user.id, name: user.name });
  const response = NextResponse.json({ user: { id: user.id, name: user.name } });

  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: SESSION_COOKIE_SECURE,
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });

  return response;
}
