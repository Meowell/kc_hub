import assert from "node:assert/strict";
import test from "node:test";

import {
  SEASONAL_MONTH_COLLECTION,
  clampRoutineProgress,
  findRoutineCollectionStep,
  summarizeRoutineProgress,
} from "./routine-collections";

test("季常月合集保留来源顺序、次数和阵容图位", () => {
  const { steps } = SEASONAL_MONTH_COLLECTION;
  const keys = new Set(steps.map((step) => step.key));
  const imageSlots = steps.reduce((count, step) => count + step.images.length, 0);

  assert.equal(steps.length, 35);
  assert.equal(keys.size, steps.length);
  assert.equal(steps[0].seaArea, "3-1");
  assert.equal(steps.at(-1)?.seaArea, "7-2-P2");
  assert.equal(findRoutineCollectionStep(SEASONAL_MONTH_COLLECTION.key, "10-1-6")?.requiredCount, 2);
  assert.equal(imageSlots, 30);
});

test("合集进度按要求次数汇总并限制异常值", () => {
  const progress = {
    "01-3-1": 1,
    "10-1-6": 1,
    "11-5-1": 9,
  };

  const summary = summarizeRoutineProgress(SEASONAL_MONTH_COLLECTION, progress);

  assert.equal(summary.totalSteps, 35);
  assert.equal(summary.requiredCount, 36);
  assert.equal(summary.completedSteps, 2);
  assert.equal(summary.completedCount, 3);
  assert.equal(summary.percent, 8);
  assert.equal(clampRoutineProgress(-1, 2), 0);
  assert.equal(clampRoutineProgress(3, 2), 2);
  assert.equal(clampRoutineProgress(1.5, 2), 0);
});
