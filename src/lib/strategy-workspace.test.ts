import assert from "node:assert/strict";
import test from "node:test";

import {
  EMPTY_STRATEGY_DOCUMENT,
  canWriteStrategyMap,
  collectStrategyAssetIds,
  extractStrategyContentPlainText,
  extractStrategyPlainText,
  isValidStrategyDocument,
  parseStrategyDocument,
} from "./strategy-workspace";

test("extractStrategyPlainText flattens structured documents", () => {
  assert.equal(extractStrategyPlainText({
    type: "doc",
    content: [
      { type: "heading", content: [{ type: "text", text: "E1 P1" }] },
      { type: "paragraph", content: [{ type: "text", text: "带对潜支援。" }] },
    ],
  }), "E1 P1\n带对潜支援。");
});

test("collectStrategyAssetIds returns unique image assets", () => {
  const content = JSON.stringify({
    type: "doc",
    content: [
      { type: "image", attrs: { assetId: "asset-a" } },
      { type: "paragraph", content: [{ type: "image", attrs: { assetId: "asset-a" } }] },
      { type: "image", attrs: { assetId: "asset-b" } },
    ],
  });
  assert.deepEqual(collectStrategyAssetIds(content, "tiptap-json-v1"), ["asset-a", "asset-b"]);
  assert.deepEqual(collectStrategyAssetIds(content, "markdown"), []);
});

test("extractStrategyContentPlainText normalizes JSON and legacy Markdown", () => {
  assert.equal(extractStrategyContentPlainText(JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "正文" }] }] }), "tiptap-json-v1"), "正文");
  assert.equal(extractStrategyContentPlainText("## E1\n[路线](https://example.com) ![图](x.png)", "markdown"), "E1\n路线");
});

test("parseStrategyDocument rejects malformed content", () => {
  assert.deepEqual(parseStrategyDocument("not-json"), EMPTY_STRATEGY_DOCUMENT);
  assert.equal(parseStrategyDocument('{"type":"doc","content":[]}').type, "doc");
});

test("isValidStrategyDocument accepts only complete Tiptap documents", () => {
  assert.equal(isValidStrategyDocument('{"type":"doc","content":[]}'), true);
  assert.equal(isValidStrategyDocument('{"type":"paragraph","content":[]}'), false);
  assert.equal(isValidStrategyDocument("not-json"), false);
});

test("strategy map gate requires open and active map", () => {
  assert.equal(canWriteStrategyMap({ isOpenForPosts: true, isDeleted: false }), true);
  assert.equal(canWriteStrategyMap({ isOpenForPosts: false, isDeleted: false }), false);
  assert.equal(canWriteStrategyMap({ isOpenForPosts: true, isDeleted: true }), false);
});
