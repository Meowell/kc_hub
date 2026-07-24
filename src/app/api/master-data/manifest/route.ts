import { NextResponse } from "next/server";

import { getApiUser, unauthorizedApiResponse } from "@/lib/auth";
import { getMasterDataManifest } from "@/lib/master-data-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();

  const manifest = await getMasterDataManifest();
  return NextResponse.json(manifest, {
    headers: {
      "cache-control": "private, no-cache",
    },
  });
}
