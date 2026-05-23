import { NextResponse } from "next/server";

import { getApiUser, unauthorizedApiResponse } from "@/lib/auth";
import { loadMasterData } from "@/lib/master-data-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();

  const data = await loadMasterData();
  return NextResponse.json(data, {
    headers: {
      "cache-control": "private, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
