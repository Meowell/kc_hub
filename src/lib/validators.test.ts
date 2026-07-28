import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { changePinSchema, renameAccountSchema } from "@/lib/validators";

describe("account settings validators", () => {
  it("trims a valid new username and requires a four-digit current PIN", () => {
    const parsed = renameAccountSchema.parse({
      newName: "  新提督名  ",
      currentPin: "1234",
    });

    assert.deepEqual(parsed, {
      newName: "新提督名",
      currentPin: "1234",
    });
    assert.equal(renameAccountSchema.safeParse({ newName: "", currentPin: "1234" }).success, false);
    assert.equal(renameAccountSchema.safeParse({ newName: "提督", currentPin: "12ab" }).success, false);
  });

  it("accepts matching new PIN values that differ from the current PIN", () => {
    assert.equal(
      changePinSchema.safeParse({
        currentPin: "1234",
        newPin: "5678",
        confirmPin: "5678",
      }).success,
      true,
    );
  });

  it("rejects mismatched, non-numeric, or unchanged PIN values", () => {
    assert.equal(
      changePinSchema.safeParse({
        currentPin: "1234",
        newPin: "5678",
        confirmPin: "5679",
      }).success,
      false,
    );
    assert.equal(
      changePinSchema.safeParse({
        currentPin: "1234",
        newPin: "1234",
        confirmPin: "1234",
      }).success,
      false,
    );
    assert.equal(
      changePinSchema.safeParse({
        currentPin: "1234",
        newPin: "56ab",
        confirmPin: "56ab",
      }).success,
      false,
    );
  });
});
