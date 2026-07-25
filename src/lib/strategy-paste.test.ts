import assert from "node:assert/strict";
import test from "node:test";

import { normalizeStrategyPastedText } from "@/components/strategy/strategy-extensions";

test("strategy plain-text paste collapses excess and invisible blank lines", () => {
  assert.equal(
    normalizeStrategyPastedText("\n第一行\r\n\r\n\u00a0\r\n\u200b\r\n第二行\n\n"),
    "第一行\n\n第二行",
  );
});
