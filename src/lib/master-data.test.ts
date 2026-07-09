import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { shipTypeLabels } from "./master-data";

describe("ship type labels", () => {
  it("keeps carrier, submarine, and support ship stype labels aligned with master data", () => {
    assert.equal(shipTypeLabels[13], "SS");
    assert.equal(shipTypeLabels[14], "SSV");
    assert.equal(shipTypeLabels[18], "CVB");
    assert.equal(shipTypeLabels[19], "AR");
    assert.equal(shipTypeLabels[20], "AS");
  });
});
