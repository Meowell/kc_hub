import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getBonusGroupsForTag,
  getShipBonusMatch,
  normalizeActivityBonusConfig,
  summarizeBonusMultipliers,
} from "./activity-bonus";

describe("activity bonus config", () => {
  const config = normalizeActivityBonusConfig({
    version: 1,
    groups: [
      {
        id: "e1-history",
        name: "E1 史实组",
        map: "E1",
        shipIds: [706, 566],
        points: [
          { code: "Z", label: "P1 Boss", multiplier: 1.07 },
          { code: "P", label: "道中", multiplier: 1.03 },
        ],
      },
      {
        id: "e1-dd-common",
        name: "DD 通用",
        map: "E1",
        shipTypeIds: [2],
        points: [{ code: "Z", multiplier: 1.02 }],
      },
      {
        id: "e2-history",
        name: "E2 史实组",
        map: "E2",
        shipIds: [100],
        points: [{ code: "Q", multiplier: 1.1 }],
      },
    ],
    tagBindings: [
      {
        tagName: "第三十一戦隊",
        map: "E1",
        groupIds: ["e1-history"],
      },
    ],
  });

  it("binds a tag to explicit groups plus all groups in the bound map", () => {
    const groups = getBonusGroupsForTag(config, {
      id: "tag-1",
      name: "第三十一戦隊",
    });

    assert.deepEqual(groups.map((group) => group.id), ["e1-history", "e1-dd-common"]);
    assert.equal(summarizeBonusMultipliers(groups), "多倍率");
  });

  it("marks named ship bonuses separately from type-only generic bonuses", () => {
    const groups = getBonusGroupsForTag(config, {
      id: "tag-1",
      name: "第三十一戦隊",
    });

    const namedMatch = getShipBonusMatch(groups, 706, 2, 706);
    assert.equal(namedMatch.hasAnyBonus, true);
    assert.equal(namedMatch.hasNamedBonus, true);
    assert.deepEqual(namedMatch.namedGroups.map((group) => group.id), ["e1-history"]);
    assert.deepEqual(namedMatch.typeGroups.map((group) => group.id), ["e1-dd-common"]);
    assert.equal(namedMatch.multiplierLabel, "x1.091");

    const genericMatch = getShipBonusMatch(groups, 999, 2, 999);
    assert.equal(genericMatch.hasAnyBonus, true);
    assert.equal(genericMatch.hasNamedBonus, false);
    assert.deepEqual(genericMatch.groups.map((group) => group.id), ["e1-dd-common"]);
    assert.equal(genericMatch.multiplierLabel, "x1.02");
  });

  it("matches named bonuses across remodel forms on both sides", () => {
    const familyGroups = normalizeActivityBonusConfig({
      version: 1,
      groups: [{
        id: "kasumi-form",
        name: "霞形态组",
        shipIds: [464],
        points: [{ code: "P", multiplier: 1.12 }],
      }],
    }).groups;
    const resolveOriginal = (shipId: number) => [49, 253, 464, 470].includes(shipId) ? 49 : shipId;

    const baseMatch = getShipBonusMatch(familyGroups, 49, 2, 49, resolveOriginal);
    const remodeledMatch = getShipBonusMatch(familyGroups, 470, 2, 49, resolveOriginal);

    assert.equal(baseMatch.hasNamedBonus, true);
    assert.equal(remodeledMatch.hasNamedBonus, true);
  });

  it("normalizes multiplier ranges to their midpoint", () => {
    const rangeConfig = normalizeActivityBonusConfig({
      version: 1,
      groups: [
        {
          id: "e1-b",
          name: "E1 B组",
          points: [
            { code: "O2", multiplier: "1.13~1.14x" },
            { code: "I", multiplier: "1.13～1.27" },
          ],
        },
      ],
    });

    assert.deepEqual(rangeConfig.groups[0].points.map((point) => point.multiplier), [1.135, 1.2]);
  });
});
