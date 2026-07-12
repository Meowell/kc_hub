import assert from "node:assert/strict";
import test from "node:test";

import { fetchRemoteImage, isPrivateNetworkAddress } from "@/lib/remote-image";

test("remote image imports reject private and reserved network addresses", () => {
  for (const address of [
    "127.0.0.1",
    "10.10.0.5",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "::1",
    "::ffff:127.0.0.1",
    "fc00::1",
    "fe80::1",
  ]) {
    assert.equal(isPrivateNetworkAddress(address), true, address);
  }
});

test("remote image imports allow public IP addresses", () => {
  assert.equal(isPrivateNetworkAddress("1.1.1.1"), false);
  assert.equal(isPrivateNetworkAddress("8.8.8.8"), false);
  assert.equal(isPrivateNetworkAddress("2606:4700:4700::1111"), false);
});

test("remote image imports enforce MIME type and size while preserving bytes", async () => {
  const bytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47]);
  const file = await fetchRemoteImage("https://images.example.com/map.png", {
    lookupImpl: async () => [{ address: "1.1.1.1" }],
    fetchImpl: async () => new Response(bytes, {
      status: 200,
      headers: { "content-type": "image/png", "content-length": String(bytes.byteLength) },
    }),
  });

  assert.equal(file.type, "image/png");
  assert.equal(file.size, bytes.byteLength);
  assert.deepEqual([...new Uint8Array(await file.arrayBuffer())], [...bytes]);
});

test("remote image imports reject hosts resolving to private networks", async () => {
  await assert.rejects(
    fetchRemoteImage("https://internal.example.com/map.png", {
      lookupImpl: async () => [{ address: "127.0.0.1" }],
      fetchImpl: async () => { throw new Error("fetch must not run"); },
    }),
    /内网图片地址/,
  );
});

test("remote image imports reject oversized and unresolvable URLs", async () => {
  await assert.rejects(
    fetchRemoteImage(`https://example.com/${"a".repeat(4096)}`),
    /地址过长/,
  );
  await assert.rejects(
    fetchRemoteImage("https://missing.example.com/map.png", {
      lookupImpl: async () => { throw new Error("DNS failure"); },
    }),
    /无法解析外部图片地址/,
  );
});
