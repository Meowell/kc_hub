import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/session";
import { registerSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const parsed = registerSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "请输入用户名和 4 位 PIN" }, { status: 400 });
  }

  const name = parsed.data.name.trim();
  const existingUser = await prisma.user.findUnique({
    where: { name },
    select: { id: true },
  });

  if (existingUser) {
    return NextResponse.json({ error: "这个用户名已经被使用" }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: {
      name,
      pinCode: await bcrypt.hash(parsed.data.pinCode, 10),
    },
    select: {
      id: true,
      name: true,
    },
  });
  const token = await createSessionToken({ userId: user.id, name: user.name });
  const response = NextResponse.json({ user });

  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });

  return response;
}
