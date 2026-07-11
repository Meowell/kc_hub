import assert from "node:assert/strict";
import test from "node:test";

import { Editor } from "@tiptap/core";

import { createStrategyExtensions } from "@/components/strategy/strategy-extensions";

test("strategy Markdown directives round-trip complex nodes", () => {
  const source = [
    ":::columns {count=2}",
    "",
    ":::column",
    "",
    "左侧说明",
    "",
    ":::",
    "",
    ":::column",
    "",
    "右侧说明",
    "",
    ":::",
    "",
    ":::",
    "",
    ':::routine-card {routineCardId="card-1" displayMode="full"} :::',
    "",
    '![海图](/uploads/map.png "strategy-asset:asset-1;align=center;width=50%")',
  ].join("\n");
  const editor = new Editor({
    extensions: createStrategyExtensions({ onPasteFiles() {} }),
    content: source,
    contentType: "markdown",
  });

  const json = editor.getJSON();
  assert.equal(json.content?.[0]?.type, "strategyColumns");
  assert.equal(json.content?.[0]?.attrs?.count, 2);
  assert.equal(json.content?.[0]?.content?.length, 2);
  assert.equal(json.content?.[1]?.type, "routineCard");
  assert.equal(json.content?.[1]?.attrs?.routineCardId, "card-1");
  assert.equal(json.content?.[1]?.attrs?.displayMode, "full");
  assert.equal(json.content?.[2]?.type, "image");
  assert.equal(json.content?.[2]?.attrs?.assetId, "asset-1");
  assert.equal(json.content?.[2]?.attrs?.displayWidth, "50%");

  const exported = editor.getMarkdown();
  assert.match(exported, /:::columns \{count="2"\}/);
  assert.match(exported, /:::column/);
  assert.match(exported, /:::routine-card \{routineCardId="card-1" displayMode="full"\} :::/);
  assert.match(exported, /strategy-asset:asset-1;align=center;width=50%/);
  editor.destroy();
});
