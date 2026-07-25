import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  mergeIdOrder,
  moveIdOntoTarget,
  parseStoredIdList,
  parseStoredStringMap,
} from "@/lib/view-preferences";

describe("view preference helpers", () => {
  it("reads only valid persisted identifiers", () => {
    assert.deepEqual(parseStoredIdList('["b","a","b",7,""]'), ["b", "a"]);
    assert.deepEqual(parseStoredIdList("{broken"), []);
    assert.deepEqual(parseStoredIdList('{"a":"b"}'), []);
  });

  it("reconciles a stored order with current members", () => {
    assert.deepEqual(
      mergeIdOrder(["a", "b", "new"], ["removed", "b", "a", "b"]),
      ["b", "a", "new"],
    );
  });

  it("moves a member upward or downward around the drop target", () => {
    assert.deepEqual(moveIdOntoTarget(["a", "b", "c"], "b", "a"), ["b", "a", "c"]);
    assert.deepEqual(moveIdOntoTarget(["a", "b", "c"], "a", "c"), ["b", "c", "a"]);
    assert.deepEqual(moveIdOntoTarget(["a", "b"], "missing", "a"), ["a", "b"]);
  });

  it("reads only non-empty string selections", () => {
    assert.deepEqual(
      parseStoredStringMap('{"section-a":"post-a","section-b":"","count":2}'),
      { "section-a": "post-a" },
    );
    assert.deepEqual(parseStoredStringMap("[]"), {});
    assert.deepEqual(parseStoredStringMap("not-json"), {});
  });
});
