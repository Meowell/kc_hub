import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createFleetParser, serializeDeckBuilderFleet } from "@/lib/fleet-parser";

function deckBuilderShip(id: number) {
  return { id, lv: id, luck: 0, items: {} };
}

function deckBuilderGroup(startId: number, count: number, fleetType?: number) {
  const group: Record<string, unknown> = {};
  if (fleetType !== undefined) group.t = fleetType;
  for (let index = 0; index < count; index++) {
    group[`s${index + 1}`] = deckBuilderShip(startId + index);
  }
  return group;
}

function battleShip(id: number) {
  return { api_ship_id: id, api_lv: id, poi_slot: [] };
}

describe("fleet parser", () => {
  const parser = createFleetParser();

  it("keeps the seventh ship in a strike force through serialization", () => {
    const parsed = parser.parseFleetData(JSON.stringify({
      version: 4,
      f1: deckBuilderGroup(1, 7),
    }));

    assert.ok(parsed);
    assert.equal(parsed.kind, "strike");
    assert.equal(parsed.groups.length, 1);
    assert.deepEqual(parsed.groups[0].ships.map((ship) => ship.id), [1, 2, 3, 4, 5, 6, 7]);

    const reparsed = parser.parseFleetData(serializeDeckBuilderFleet(parsed));
    assert.ok(reparsed);
    assert.equal(reparsed.kind, "strike");
    assert.equal(reparsed.groups[0].ships.length, 7);
  });

  it("keeps both six-ship fleets in a combined fleet through serialization", () => {
    const parsed = parser.parseFleetData(JSON.stringify({
      version: 4,
      f1: deckBuilderGroup(1, 6, 2),
      f2: deckBuilderGroup(101, 6, 2),
    }));

    assert.ok(parsed);
    assert.equal(parsed.kind, "combined");
    assert.equal(parsed.fleetType, 2);
    assert.deepEqual(parsed.groups.map((group) => group.ships.length), [6, 6]);
    assert.deepEqual(parsed.groups[1].ships.map((ship) => ship.id), [101, 102, 103, 104, 105, 106]);

    const serialized = serializeDeckBuilderFleet(parsed);
    const serializedJson = JSON.parse(serialized);
    assert.equal(serializedJson.f1.t, 2);
    assert.equal(serializedJson.f2.t, 2);
    assert.equal(serializedJson.f2.s6.id, 106);

    const reparsed = parser.parseFleetData(serialized);
    assert.ok(reparsed);
    assert.deepEqual(reparsed.groups.map((group) => group.ships.length), [6, 6]);
  });

  it("accepts seven ships and main plus escort groups from battle records", () => {
    const strike = parser.parseFleetData(JSON.stringify({
      fleet: { main: Array.from({ length: 7 }, (_, index) => battleShip(index + 1)) },
    }));
    assert.ok(strike);
    assert.equal(strike.kind, "strike");
    assert.equal(strike.groups[0].ships.length, 7);

    const combined = parser.parseFleetData(JSON.stringify({
      fleet: {
        type: 3,
        main: Array.from({ length: 6 }, (_, index) => battleShip(index + 1)),
        escort: Array.from({ length: 6 }, (_, index) => battleShip(index + 101)),
      },
    }));
    assert.ok(combined);
    assert.equal(combined.kind, "combined");
    assert.equal(combined.fleetType, 3);
    assert.deepEqual(combined.groups.map((group) => group.ships.length), [6, 6]);
  });
});
