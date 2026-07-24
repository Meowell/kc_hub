import { readMasterDataAsset } from "@/lib/master-data-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: {
    fileName: string;
  };
};

export async function GET(_request: Request, { params }: RouteContext) {
  const match = /^([a-f0-9]{64})\.json$/.exec(params.fileName);
  if (!match) {
    return new Response("Not found", { status: 404 });
  }

  const body = await readMasterDataAsset(match[1]);
  if (!body) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(new Uint8Array(body), {
    headers: {
      "cache-control": "public, max-age=31536000, immutable",
      "content-length": String(body.byteLength),
      "content-type": "application/json; charset=utf-8",
    },
  });
}
