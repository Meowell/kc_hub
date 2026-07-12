import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import type { UploadedImageFile } from "@/lib/storage";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const allowedImageTypes = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]);

function isPrivateIpv4(address: string) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return a === 0
    || a === 10
    || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && (b === 0 || b === 168))
    || (a === 198 && (b === 18 || b === 19 || b === 51))
    || (a === 203 && b === 0)
    || a >= 224;
}

export function isPrivateNetworkAddress(address: string) {
  const normalized = address.toLowerCase().split("%")[0];
  const version = isIP(normalized);
  if (version === 4) return isPrivateIpv4(normalized);
  if (version !== 6) return true;
  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("::ffff:")) return isPrivateIpv4(normalized.slice(7));
  return normalized.startsWith("fc")
    || normalized.startsWith("fd")
    || /^fe[89ab]/.test(normalized)
    || normalized.startsWith("ff")
    || normalized.startsWith("2001:db8:");
}

type RemoteImageOptions = {
  fetchImpl?: typeof fetch;
  lookupImpl?: (hostname: string) => Promise<Array<{ address: string }>>;
};

async function assertPublicRemoteUrl(value: string, lookupImpl: NonNullable<RemoteImageOptions["lookupImpl"]>) {
  if (value.length > 4096) throw new Error("外部图片地址过长");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("外部图片地址无效");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("仅支持公开的 HTTP/HTTPS 图片地址");
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  let records: Array<{ address: string }>;
  try {
    records = isIP(hostname)
      ? [{ address: hostname }]
      : await lookupImpl(hostname);
  } catch {
    throw new Error("无法解析外部图片地址");
  }
  if (records.length === 0 || records.some((record) => isPrivateNetworkAddress(record.address))) {
    throw new Error("不能读取内网图片地址");
  }
  return url;
}

async function readLimitedBody(response: Response) {
  if (!response.body) throw new Error("外部图片没有响应内容");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_IMAGE_BYTES) {
      await reader.cancel();
      throw new Error("外部图片不能超过 10MB");
    }
    chunks.push(value);
  }
  if (total === 0) throw new Error("外部图片内容为空或已失效");
  const contents = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    contents.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return contents;
}

export async function fetchRemoteImage(value: string, options: RemoteImageOptions = {}): Promise<UploadedImageFile> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const lookupImpl = options.lookupImpl ?? (async (hostname: string) => lookup(hostname, { all: true, verbatim: true }));
  let currentUrl = value;
  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const url = await assertPublicRemoteUrl(currentUrl, lookupImpl);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    let response: Response;
    try {
      response = await fetchImpl(url, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          accept: "image/avif,image/webp,image/png,image/jpeg,image/gif,image/*;q=0.8",
          "user-agent": "KanColle-Hub-Image-Importer/1.0",
        },
      });
    } catch (error) {
      throw new Error(error instanceof Error && error.name === "AbortError" ? "读取外部图片超时" : "无法读取外部图片");
    } finally {
      clearTimeout(timer);
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirectCount === MAX_REDIRECTS) throw new Error("外部图片重定向过多");
      currentUrl = new URL(location, url).toString();
      continue;
    }
    if (!response.ok) throw new Error(`外部图片无法读取（HTTP ${response.status}）`);
    const contentType = response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() ?? "";
    if (!allowedImageTypes.has(contentType)) throw new Error("外部地址返回的不是受支持图片");
    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BYTES) throw new Error("外部图片不能超过 10MB");
    const contents = await readLimitedBody(response);
    return {
      type: contentType,
      size: contents.byteLength,
      arrayBuffer: async () => contents.buffer.slice(contents.byteOffset, contents.byteOffset + contents.byteLength),
    };
  }
  throw new Error("外部图片读取失败");
}
