import assert from "node:assert/strict";
import test from "node:test";

import { buildNoro6Preview, deriveShipStock, normalizeNoro6Input } from "@/lib/noro6";

const lookup = {
  shipNameById: new Map([
    [101, "睦月"],
    [102, "如月"],
  ]),
  equipNameById: new Map([[201, "12cm单装炮"]]),
  shipTypeById: new Map([
    [101, 2],
    [102, 2],
  ]),
};

test("buildNoro6Preview returns counts and unknown master ids", () => {
  const preview = buildNoro6Preview(
    JSON.stringify({
      ships: [
        { id: 101, lv: 20 },
        { ship_id: 999, lv: 1 },
      ],
      items: [
        { id: 201, lv: 0 },
        { id: 888, lv: 3 },
      ],
    }),
    "",
    lookup,
  );

  assert.equal(preview.shipCount, 2);
  assert.equal(preview.equipmentCount, 2);
  assert.equal(preview.shipTypeCount, 1);
  assert.deepEqual(preview.unknownShipIds, [999]);
  assert.deepEqual(preview.unknownEquipmentIds, [888]);
  assert.equal(preview.hasEquipmentData, true);
});

test("buildNoro6Preview compares normalized data with previous stock", () => {
  const previous = normalizeNoro6Input(JSON.stringify({
    ships: [{ id: 101, lv: 20 }],
    items: [{ id: 201, lv: 0 }, { id: 201, lv: 0 }],
  }));

  const preview = buildNoro6Preview(
    JSON.stringify({
      ships: [{ id: 102, lv: 30 }],
      items: [{ id: 201, lv: 0 }],
    }),
    previous,
    lookup,
  );

  assert.equal(preview.addedShipCount, 1);
  assert.equal(preview.removedShipCount, 1);
  assert.equal(preview.addedEquipmentCount, 0);
  assert.equal(preview.removedEquipmentCount, 1);
});

test("buildNoro6Preview preserves existing equipment for ship-only imports", () => {
  const previous = normalizeNoro6Input(JSON.stringify({
    ships: [{ id: 101, lv: 20 }],
    items: [{ id: 201, lv: 0 }],
  }));

  const preview = buildNoro6Preview(JSON.stringify([{ id: 102, lv: 40, st: [] }]), previous, lookup);

  assert.equal(preview.shipCount, 1);
  assert.equal(preview.equipmentCount, 1);
  assert.equal(JSON.parse(preview.normalizedData).items.length, 1);
});

test("deriveShipStock uses per-ship occurrence ids for lock assignments", () => {
  const stocks = deriveShipStock(JSON.stringify({
    ships: [
      { id: 101, lv: 20 },
      { id: 102, lv: 30 },
      { id: 101, lv: 40 },
    ],
    items: [],
  }));

  assert.deepEqual(stocks.map((stock) => stock.uniqueId), ["101:0", "102:0", "101:1"]);
});
