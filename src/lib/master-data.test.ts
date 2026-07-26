import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createMasterLookup,
  getAvailableShipTypeOptions,
  shipTypeLabels,
  type MasterData,
} from "./master-data";
import {
  matchesShipSearchText,
  normalizeShipSearchQuery,
} from "./ship-search";

const kasumiForms: MasterData["start2"]["api_mst_ship"] = [
  { api_id: 49, api_name: "霞", api_stype: 2, api_aftershipid: "253" },
  { api_id: 253, api_name: "霞改", api_stype: 2, api_aftershipid: "464" },
  { api_id: 464, api_name: "霞改二", api_stype: 2, api_aftershipid: "470" },
  { api_id: 470, api_name: "霞改二乙", api_stype: 2, api_aftershipid: "464" },
];

function createKasumiMasterData(shipHp: MasterData["shipHp"]): MasterData {
  return {
    start2: {
      api_mst_ship: kasumiForms,
      api_mst_slotitem: [],
      api_mst_stype: [],
      api_mst_slotitem_equiptype: [],
    },
    shipHp,
    source: "runtime",
  };
}

describe("ship type labels", () => {
  it("keeps carrier, submarine, and support ship stype labels aligned with master data", () => {
    assert.equal(shipTypeLabels[13], "SS");
    assert.equal(shipTypeLabels[14], "SSV");
    assert.equal(shipTypeLabels[18], "CVB");
    assert.equal(shipTypeLabels[19], "AR");
    assert.equal(shipTypeLabels[20], "AS");
  });

  it("only exposes ship type filters that exist in the current fleet", () => {
    assert.deepEqual(
      getAvailableShipTypeOptions([22, 2, 22]),
      [
        { id: 2, name: "DD" },
        { id: 22, name: "AO" },
      ],
    );
  });

  it("uses authoritative original ids for every remodel form", () => {
    const lookup = createMasterLookup(createKasumiMasterData(
      kasumiForms.map((ship) => ({ id: ship.api_id, hp: 1, hp2: 1, max_hp: 1, orig: 49 })),
    ));

    assert.deepEqual(
      kasumiForms.map((ship) => lookup.origByShipId.get(ship.api_id)),
      [49, 49, 49, 49],
    );
  });

  it("keeps remodel branches connected when original ids are unavailable", () => {
    const lookup = createMasterLookup(createKasumiMasterData([]));

    assert.equal(lookup.origByShipId.get(464), 49);
    assert.equal(lookup.origByShipId.get(470), 49);
  });

  it("indexes original, simplified, and reading variants for ship search", () => {
    const lookup = createMasterLookup({
      start2: {
        api_mst_ship: [
          { api_id: 43, api_name: "時雨", api_yomi: "しぐれ", api_stype: 2 },
        ],
        api_mst_slotitem: [],
        api_mst_stype: [],
        api_mst_slotitem_equiptype: [],
      },
      shipHp: [],
      source: "runtime",
    });
    const searchText = lookup.shipSearchTextById.get(43) ?? "";

    assert.equal(
      matchesShipSearchText(searchText, normalizeShipSearchQuery("时")),
      true,
    );
    assert.equal(
      matchesShipSearchText(searchText, normalizeShipSearchQuery("しぐれ")),
      true,
    );
  });
});
