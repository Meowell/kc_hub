import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/audit";
import { getApiUser, unauthorizedApiResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, clearRateLimit } from "@/lib/rate-limit";
import { changePinSchema } from "@/lib/validators";

const RATE_LIMIT_OPTIONS = { limit: 8, windowMs: 10 * 60 * 1000 };

export async function PATCH(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();

  const parsed = changePinSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "请完整填写当前 PIN 和新 PIN" },
      { status: 400 },
    );
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
    select: { pinCode: true },
  });
  if (!account || !(await bcrypt.compare(parsed.data.currentPin, account.pinCode))) {
    return NextResponse.json({ error: "当前 PIN 不正确" }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { pinCode: await bcrypt.hash(parsed.data.newPin, 10) },
  });
  await writeAuditLog({
    actorId: user.id,
    action: "account.pin_change",
    entityType: "User",
    entityId: user.id,
    after: { pinChanged: true },
  });

  clearRateLimit(rateLimitKey);
  return NextResponse.json({ ok: true });
}
