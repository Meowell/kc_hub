import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCopiedLockPlan,
  buildLockMatrixSummary,
  getDefaultMobileTagId,
  getSaveStatusDisplay,
  getTagDisableImpact,
  moveAssignmentBetweenTags,
  reorderAssignmentWithinTag,
} from "./lock-plan-helpers";
import { type ShipStock } from "./noro6";

function ship(uniqueId: string, shipId: number, level: number): ShipStock {
  return {
    uniqueId,
    shipId,
    level,
    firepower: 0,
    torpedo: 0,
    antiAir: 0,
    armor: 0,
    luck: 0,
    hp: 0,
    asw: 0,
  };
}

describe("buildCopiedLockPlan", () => {
  it("matches exact ship ids only and leaves other remodels as hinted empty slots", () => {
    const result = buildCopiedLockPlan({
      sourceAssignments: [{ uniqueId: "source-101", shipId: 101 }],
      sourceShips: [ship("source-101", 101, 70)],
      targetShips: [ship("target-102", 102, 70)],
      targetAssignments: [],
      otherTargetAssignments: [],
    });

    assert.deepEqual(result.assignments, [null]);
    assert.deepEqual(result.hints, [{ shipId: 101, sourceLevel: 70 }]);
    assert.equal(result.matchedCount, 0);
    assert.equal(result.missingCount, 1);
  });

  it("uses each exact-form copy once and selects the closest source level", () => {
    const result = buildCopiedLockPlan({
      sourceAssignments: [
        { uniqueId: "source-low", shipId: 101 },
        { uniqueId: "source-high", shipId: 101 },
      ],
      sourceShips: [
        ship("source-low", 101, 50),
        ship("source-high", 101, 80),
      ],
      targetShips: [
        ship("target-55", 101, 55),
        ship("target-75", 101, 75),
      ],
      targetAssignments: [],
      otherTargetAssignments: [],
    });

    assert.deepEqual(result.assignments, [
      { uniqueId: "target-55", shipId: 101 },
      { uniqueId: "target-75", shipId: 101 },
    ]);
    assert.equal(result.matchedCount, 2);
    assert.equal(result.missingCount, 0);
  });

  it("prefers the higher level on an equal distance and then a stable unique id", () => {
    const result = buildCopiedLockPlan({
      sourceAssignments: [
        { uniqueId: "source", shipId: 101 },
        { uniqueId: "missing-level", shipId: 102 },
      ],
      sourceShips: [ship("source", 101, 60)],
      targetShips: [
        ship("target-low", 101, 50),
        ship("target-high", 101, 70),
        ship("target-b", 102, 90),
        ship("target-a", 102, 90),
      ],
      targetAssignments: [],
      otherTargetAssignments: [],
    });

    assert.deepEqual(result.assignments, [
      { uniqueId: "target-high", shipId: 101 },
      { uniqueId: "target-a", shipId: 102 },
    ]);
  });

  it("releases ships in the replaced tag while excluding ships locked in other tags", () => {
    const result = buildCopiedLockPlan({
      sourceAssignments: [{ uniqueId: "source", shipId: 101 }],
      sourceShips: [ship("source", 101, 80)],
      targetShips: [
        ship("released", 101, 75),
        ship("locked-elsewhere", 101, 80),
      ],
      targetAssignments: [{ uniqueId: "released", shipId: 101 }],
      otherTargetAssignments: [{ uniqueId: "locked-elsewhere", shipId: 101 }],
    });

    assert.deepEqual(result.assignments, [{ uniqueId: "released", shipId: 101 }]);
    assert.equal(result.replacedCount, 1);
  });

  it("preserves source gaps and emits hints for every unmatched occupied slot", () => {
    const result = buildCopiedLockPlan({
      sourceAssignments: [
        { uniqueId: "source-a", shipId: 101 },
        null,
        { uniqueId: "source-b", shipId: 102 },
      ],
      sourceShips: [
        ship("source-a", 101, 40),
        ship("source-b", 102, 90),
      ],
      targetShips: [ship("target-a", 101, 42)],
      targetAssignments: [
        { uniqueId: "old-a", shipId: 201 },
        { uniqueId: "old-b", shipId: 202 },
      ],
      otherTargetAssignments: [],
    });

    assert.deepEqual(result.assignments, [
      { uniqueId: "target-a", shipId: 101 },
      null,
      null,
    ]);
    assert.deepEqual(result.hints, [
      null,
      null,
      { shipId: 102, sourceLevel: 90 },
    ]);
    assert.deepEqual(
      {
        sourceCount: result.sourceCount,
        matchedCount: result.matchedCount,
        missingCount: result.missingCount,
        replacedCount: result.replacedCount,
      },
      { sourceCount: 2, matchedCount: 1, missingCount: 1, replacedCount: 2 },
    );
  });

  it("handles empty sources and an empty target ship pool", () => {
    assert.deepEqual(
      buildCopiedLockPlan({
        sourceAssignments: [],
        sourceShips: [],
        targetShips: [],
        targetAssignments: [],
        otherTargetAssignments: [],
      }),
      {
        assignments: [],
        hints: [],
        sourceCount: 0,
        matchedCount: 0,
        missingCount: 0,
        replacedCount: 0,
      },
    );

    const noStock = buildCopiedLockPlan({
      sourceAssignments: [{ uniqueId: "source", shipId: 101 }],
      sourceShips: [],
      targetShips: [],
      targetAssignments: [],
      otherTargetAssignments: [],
    });
    assert.deepEqual(noStock.hints, [{ shipId: 101, sourceLevel: null }]);
  });
});

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

describe("reorderAssignmentWithinTag", () => {
  it("swaps ships when dropping onto an occupied slot in the same tag", () => {
    const assignments = [
      { uniqueId: "ship-1", shipId: 101 },
      null,
      { uniqueId: "ship-2", shipId: 102 },
    ];

    assert.deepEqual(
      reorderAssignmentWithinTag(assignments, "ship-1", 101, 2),
      [
        { uniqueId: "ship-2", shipId: 102 },
        null,
        { uniqueId: "ship-1", shipId: 101 },
      ],
    );
  });

  it("moves the dragged ship when dropping onto an empty slot", () => {
    const assignments = [
      { uniqueId: "ship-1", shipId: 101 },
      null,
      { uniqueId: "ship-2", shipId: 102 },
    ];

    assert.deepEqual(
      reorderAssignmentWithinTag(assignments, "ship-2", 102, 1),
      [
        { uniqueId: "ship-1", shipId: 101 },
        { uniqueId: "ship-2", shipId: 102 },
      ],
    );
  });
});

describe("moveAssignmentBetweenTags", () => {
  it("swaps the target ship back to the source slot when dropping onto an occupied cross-tag slot", () => {
    const sourceAssignments = [
      { uniqueId: "ship-1", shipId: 101 },
      null,
      { uniqueId: "ship-2", shipId: 102 },
    ];
    const targetAssignments = [
      { uniqueId: "ship-3", shipId: 103 },
    ];

    assert.deepEqual(
      moveAssignmentBetweenTags(sourceAssignments, targetAssignments, "ship-1", 101, 0),
      {
        sourceAssignments: [
          { uniqueId: "ship-3", shipId: 103 },
          null,
          { uniqueId: "ship-2", shipId: 102 },
        ],
        targetAssignments: [
          { uniqueId: "ship-1", shipId: 101 },
        ],
      },
    );
  });

  it("moves the dragged ship out of the source slot when dropping onto an empty cross-tag slot", () => {
    const sourceAssignments = [
      { uniqueId: "ship-1", shipId: 101 },
      { uniqueId: "ship-2", shipId: 102 },
    ];
    const targetAssignments = [
      { uniqueId: "ship-3", shipId: 103 },
    ];

    assert.deepEqual(
      moveAssignmentBetweenTags(sourceAssignments, targetAssignments, "ship-2", 102, 1),
      {
        sourceAssignments: [
          { uniqueId: "ship-1", shipId: 101 },
        ],
        targetAssignments: [
          { uniqueId: "ship-3", shipId: 103 },
          { uniqueId: "ship-2", shipId: 102 },
        ],
      },
    );
  });
});
