import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { filterRowsByLockTag, getSafePage, shouldFlushLatestSnapshot } from "@/lib/frontend-ux";

describe("frontend UX regression helpers", () => {
  it("clamps an out-of-range routine page before querying", () => {
    assert.deepEqual(getSafePage(999, 23, 10), { currentPage: 3, totalPages: 3 });
    assert.deepEqual(getSafePage(-4, 0, 10), { currentPage: 1, totalPages: 1 });
  });

  it("filters ship rows by a real lock assignment", () => {
    const rows = [{ rowId: "101-0" }, { rowId: "102-1" }, { rowId: "103-2" }];
    const assignments = { red: ["101-0"], blue: ["102-1"] };
    assert.deepEqual(filterRowsByLockTag(rows, "red", assignments), [{ rowId: "101-0" }]);
    assert.deepEqual(filterRowsByLockTag(rows, "unassigned", assignments), [{ rowId: "103-2" }]);
    assert.deepEqual(filterRowsByLockTag(rows, "missing", assignments), []);
  });

  it("only flushes the newest unsaved snapshot when the queue is idle", () => {
    assert.equal(shouldFlushLatestSnapshot("latest", "older", false), true);
    assert.equal(shouldFlushLatestSnapshot("latest", "latest", false), false);
    assert.equal(shouldFlushLatestSnapshot("latest", "older", true), false);
  });
});
