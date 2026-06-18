import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canEditOwnedResource,
  canManageSharedResource,
  getActivityArchiveData,
  getRoleLabel,
  getVisibleContentWhere,
  isActivityWritable,
  isLockPlanVersionConflict,
  normalizeRole,
} from "@/lib/collaboration";

describe("collaboration helpers", () => {
  it("normalizes unknown roles to member", () => {
    assert.equal(normalizeRole("admin"), "admin");
    assert.equal(normalizeRole("planner"), "planner");
    assert.equal(normalizeRole("member"), "member");
    assert.equal(normalizeRole("captain"), "member");
    assert.equal(normalizeRole(undefined), "member");
  });

  it("formats role labels for account badges", () => {
    assert.equal(getRoleLabel("admin"), "ADMIN");
    assert.equal(getRoleLabel("planner"), "PLANNER");
    assert.equal(getRoleLabel("member"), "MEMBER");
    assert.equal(getRoleLabel("captain"), "MEMBER");
  });

  it("allows planner/admin to manage shared resources, but not regular members", () => {
    assert.equal(canManageSharedResource({ id: "u1", role: "member" }), false);
    assert.equal(canManageSharedResource({ id: "u2", role: "planner" }), true);
    assert.equal(canManageSharedResource({ id: "u3", role: "admin" }), true);
  });

  it("allows owners and elevated roles to edit owned resources", () => {
    assert.equal(canEditOwnedResource({ id: "u1", role: "member" }, "u1"), true);
    assert.equal(canEditOwnedResource({ id: "u1", role: "member" }, "u2"), false);
    assert.equal(canEditOwnedResource({ id: "u1", role: "planner" }, "u2"), true);
    assert.equal(canEditOwnedResource({ id: "u1", role: "admin" }, "u2"), true);
  });

  it("treats archived and hidden activities as read-only", () => {
    assert.equal(isActivityWritable(null), true);
    assert.equal(isActivityWritable({ status: "active", isActive: true }), true);
    assert.equal(isActivityWritable({ status: "archived", isActive: true }), false);
    assert.equal(isActivityWritable({ status: "hidden", isActive: true }), false);
    assert.equal(isActivityWritable({ status: "active", isActive: false }), false);
  });

  it("builds soft-delete and archive query fragments", () => {
    assert.deepEqual(getVisibleContentWhere({ activityId: "a1" }), {
      activityId: "a1",
      isDeleted: false,
    });
    assert.deepEqual(getActivityArchiveData(), {
      status: "archived",
      isActive: true,
    });
  });

  it("detects explicit lock-plan version conflicts", () => {
    assert.equal(isLockPlanVersionConflict(3, 3), false);
    assert.equal(isLockPlanVersionConflict(3, 2), true);
    assert.equal(isLockPlanVersionConflict(3, undefined), true);
  });
});
