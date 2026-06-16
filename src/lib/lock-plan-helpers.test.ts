import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildLockMatrixSummary,
  getDefaultMobileTagId,
  getSaveStatusDisplay,
  getTagDisableImpact,
} from "./lock-plan-helpers";

describe("buildLockMatrixSummary", () => {
  it("counts active tags, assigned ships, missing ship data, and duplicate lock conflicts", () => {
    const summary = buildLockMatrixSummary(
      [
        { id: "tag-e1", isActive: true },
        { id: "tag-e2", isActive: true },
        { id: "tag-old", isActive: false },
      ],
      [
        {
          userId: "alice",
          hasShipData: true,
          plans: [
            {
              tagId: "tag-e1",
              assignedData: JSON.stringify([
                { uniqueId: "ship-1", shipId: 101 },
                null,
                { uniqueId: "ship-2", shipId: 102 },
              ]),
            },
            {
              tagId: "tag-e2",
              assignedData: JSON.stringify([{ uniqueId: "ship-1", shipId: 101 }]),
            },
            {
              tagId: "tag-old",
              assignedData: JSON.stringify([{ uniqueId: "ignored", shipId: 999 }]),
            },
          ],
        },
        {
          userId: "bob",
          hasShipData: false,
          plans: [
            {
              tagId: "tag-e1",
              assignedData: JSON.stringify([{ uniqueId: "ship-3", shipId: 103 }]),
            },
          ],
        },
      ],
    );

    assert.equal(summary.activeTagCount, 2);
    assert.equal(summary.assignedShipCount, 4);
    assert.equal(summary.missingShipDataCount, 1);
    assert.equal(summary.conflictCount, 1);
    assert.deepEqual(summary.conflicts, [
      {
        userId: "alice",
        uniqueId: "ship-1",
        shipId: 101,
        tagIds: ["tag-e1", "tag-e2"],
      },
    ]);
  });

  it("ignores malformed assignment JSON instead of crashing", () => {
    const summary = buildLockMatrixSummary(
      [{ id: "tag-e1", isActive: true }],
      [{ userId: "alice", hasShipData: true, plans: [{ tagId: "tag-e1", assignedData: "not-json" }] }],
    );

    assert.equal(summary.assignedShipCount, 0);
    assert.equal(summary.conflictCount, 0);
  });
});

describe("getSaveStatusDisplay", () => {
  it("formats synced state with a readable last sync time", () => {
    assert.deepEqual(getSaveStatusDisplay("synced", new Date(2026, 5, 16, 13, 5)), {
      label: "SYNCED / 已同步",
      variant: "success",
      detail: "最近同步 13:05",
    });
  });

  it("maps conflict state to danger styling and refresh guidance", () => {
    assert.deepEqual(getSaveStatusDisplay("conflict"), {
      label: "CONFLICT / 冲突",
      variant: "danger",
      detail: "锁船计划已被更新，请刷新后再编辑",
    });
  });
});

describe("getTagDisableImpact", () => {
  it("counts plans and assigned ships affected by disabling a tag", () => {
    assert.deepEqual(
      getTagDisableImpact("tag-e1", [
        {
          userId: "alice",
          plans: [
            {
              tagId: "tag-e1",
              assignedData: JSON.stringify([
                { uniqueId: "ship-1", shipId: 101 },
                null,
                { uniqueId: "ship-2", shipId: 102 },
              ]),
            },
          ],
        },
        {
          userId: "bob",
          plans: [
            { tagId: "tag-e1", assignedData: JSON.stringify([{ uniqueId: "ship-3", shipId: 103 }]) },
            { tagId: "tag-e2", assignedData: JSON.stringify([{ uniqueId: "ship-4", shipId: 104 }]) },
          ],
        },
      ]),
      { planCount: 2, assignedShipCount: 3, affectedUserIds: ["alice", "bob"] },
    );
  });
});

describe("getDefaultMobileTagId", () => {
  it("prefers the first tag with current-user assignments", () => {
    assert.equal(
      getDefaultMobileTagId(
        [
          { id: "tag-e1", isActive: true },
          { id: "tag-e2", isActive: true },
        ],
        {
          "tag-e1": "[]",
          "tag-e2": JSON.stringify([{ uniqueId: "ship-1", shipId: 101 }]),
        },
      ),
      "tag-e2",
    );
  });

  it("falls back to the first active tag when the user has no assignments", () => {
    assert.equal(
      getDefaultMobileTagId(
        [
          { id: "tag-old", isActive: false },
          { id: "tag-e1", isActive: true },
        ],
        {},
      ),
      "tag-e1",
    );
  });
});
