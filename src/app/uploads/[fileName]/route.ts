import { readUploadedImage } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: { fileName: string } };

async function getUploadedImage(fileName: string, includeBody: boolean) {
  const image = await readUploadedImage(fileName);
  if (!image) return new Response(null, { status: 404 });

  return new Response(includeBody ? image.contents : null, {
    headers: {
      "cache-control": "public, max-age=31536000, immutable",
      "content-length": String(image.contents.byteLength),
      "content-type": image.contentType,
      "x-content-type-options": "nosniff",
    },
  });
}

export async function GET(_request: Request, { params }: RouteContext) {
  return getUploadedImage(params.fileName, true);
}

export async function HEAD(_request: Request, { params }: RouteContext) {
  return getUploadedImage(params.fileName, false);
}
