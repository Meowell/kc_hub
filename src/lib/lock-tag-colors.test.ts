import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getLockTagColorStyle,
  getLockTagStripStyle,
} from "@/lib/lock-tag-colors";

describe("lock tag colors", () => {
  it("softens dark custom colors and chooses the higher-contrast text", () => {
    assert.deepEqual(getLockTagColorStyle("#b3383b"), {
      backgroundColor: "#c5686a",
      color: "#0f172a",
      borderColor: "#c5686a",
    });
  });

  it("only slightly softens already-light custom colors", () => {
    assert.deepEqual(getLockTagColorStyle("#d5c6bb"), {
      backgroundColor: "#d8c9bf",
      color: "#0f172a",
      borderColor: "#d8c9bf",
    });
  });

  it("keeps narrow accent strips at the original official color", () => {
    assert.deepEqual(getLockTagStripStyle("#b3383b"), {
      backgroundColor: "#b3383b",
    });
  });
});
