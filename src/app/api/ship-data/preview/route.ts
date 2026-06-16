import { NextResponse } from "next/server";

import { getApiUser, unauthorizedApiResponse } from "@/lib/auth";
import { createMasterLookup } from "@/lib/master-data";
import { loadMasterData } from "@/lib/master-data-server";
import { buildNoro6Preview } from "@/lib/noro6";
import { shipDataSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();

  const parsed = shipDataSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "存档内容不能为空，且不能超过 8MB" }, { status: 400 });
  }

  try {
    const masterData = await loadMasterData();
    const preview = buildNoro6Preview(
      parsed.data.shipData,
      user.shipData ?? "",
      createMasterLookup(masterData),
    );

    return NextResponse.json({ preview });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "noro6 存档格式错误" },
      { status: 400 },
    );
  }
}
