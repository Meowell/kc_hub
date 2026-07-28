import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/audit";
import { getApiUser, unauthorizedApiResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, clearRateLimit } from "@/lib/rate-limit";
import {
  createSessionToken,
  SESSION_COOKIE,
  SESSION_COOKIE_SECURE,
  SESSION_MAX_AGE,
} from "@/lib/session";
import { renameAccountSchema } from "@/lib/validators";

const RATE_LIMIT_OPTIONS = { limit: 8, windowMs: 10 * 60 * 1000 };

export async function PATCH(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();

  const parsed = renameAccountSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "请输入新用户名和当前 PIN" },
      { status: 400 },
    );
  }

  const newName = parsed.data.newName.trim();
  if (newName === user.name) {
    return NextResponse.json({ error: "新用户名与当前用户名相同" }, { status: 400 });
  }

  const rateLimitKey = `account-auth:${user.id}`;
  const rateLimit = checkRateLimit(rateLimitKey, RATE_LIMIT_OPTIONS);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "验证尝试过多，请稍后再试" },
      { status: 429, headers: { "retry-after": String(rateLimit.retryAfterSeconds) } },
    );
  }

  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { name: true, pinCode: true },
  });
  if (!account || !(await bcrypt.compare(parsed.data.currentPin, account.pinCode))) {
    return NextResponse.json({ error: "当前 PIN 不正确" }, { status: 401 });
  }

  const existingUser = await prisma.user.findUnique({
    where: { name: newName },
    select: { id: true },
  });
  if (existingUser) {
    return NextResponse.json({ error: "这个用户名已经被使用" }, { status: 409 });
  }

  try {
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { name: newName },
      select: { id: true, name: true },
    });
    await writeAuditLog({
      actorId: user.id,
      action: "account.rename",
      entityType: "User",
      entityId: user.id,
      before: { name: account.name },
      after: { name: updated.name },
    });

    clearRateLimit(rateLimitKey);
    const token = await createSessionToken({ userId: updated.id, name: updated.name });
    const response = NextResponse.json({ user: updated });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: SESSION_COOKIE_SECURE,
      maxAge: SESSION_MAX_AGE,
      path: "/",
    });
    return response;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "这个用户名已经被使用" }, { status: 409 });
    }
    throw error;
  }
}
