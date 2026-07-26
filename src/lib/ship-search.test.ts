import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildShipSearchText,
  matchesShipSearchText,
  normalizeShipSearchQuery,
  toSimplifiedShipName,
} from "./ship-search";

describe("ship search aliases", () => {
  it("converts traditional and Japanese-specific ship-name characters", () => {
    assert.equal(toSimplifiedShipName("時雨改二"), "时雨改二");
    assert.equal(toSimplifiedShipName("暁"), "晓");
    assert.equal(toSimplifiedShipName("浜風"), "滨风");
    assert.equal(toSimplifiedShipName("龍驤"), "龙骧");
    assert.equal(toSimplifiedShipName("瑞鶴"), "瑞鹤");
  });

  it("matches original names, simplified aliases, readings, and ids", () => {
    const searchText = buildShipSearchText({
      shipId: 43,
      name: "時雨",
      yomi: "しぐれ",
    });

    for (const query of ["時", "时", "时雨", "しぐれ", "43"]) {
      assert.equal(
        matchesShipSearchText(searchText, normalizeShipSearchQuery(query)),
        true,
        query,
      );
    }
    assert.equal(
      matchesShipSearchText(searchText, normalizeShipSearchQuery("雪風")),
      false,
    );
  });

  it("normalizes full-width latin text and keeps empty queries unfiltered", () => {
    const searchText = buildShipSearchText({
      shipId: 174,
      name: "Z1",
      yomi: "レーベレヒト・マース",
    });

    assert.equal(
      matchesShipSearchText(searchText, normalizeShipSearchQuery("Ｚ１")),
      true,
    );
    assert.equal(matchesShipSearchText(searchText, normalizeShipSearchQuery("  ")), true);
  });
});
