import assert from "node:assert/strict";
import test from "node:test";

import {
  STRATEGY_DEFAULT_TEMPLATE,
  createStrategyFormDefaults,
  filterRoutineCardsForInsert,
} from "@/lib/strategy-helpers";

test("createStrategyFormDefaults starts with the strategy template", () => {
  const form = createStrategyFormDefaults();

  assert.equal(form.content, STRATEGY_DEFAULT_TEMPLATE);
  assert.match(form.content, /## 路线/);
  assert.match(form.content, /## 参考阵容/);
});

test("filterRoutineCardsForInsert searches sea area, mission and uploader", () => {
  const cards = [
    { seaArea: "E1-1", missionName: "运输", user: { name: "Akashi" } },
    { seaArea: "E2-3", missionName: "削甲", user: { name: "Yamato" } },
  ];

  assert.deepEqual(filterRoutineCardsForInsert(cards, "削甲"), [cards[1]]);
  assert.deepEqual(filterRoutineCardsForInsert(cards, "akashi"), [cards[0]]);
  assert.deepEqual(filterRoutineCardsForInsert(cards, "E1"), [cards[0]]);
});
