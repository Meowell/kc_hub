import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function loginAs(page: Page, userName: string, pin: string) {
  await page.goto("/login");
  await page.getByLabel("用户名").fill(userName);
  await page.getByLabel("PIN 码").fill(pin);
  await page.getByRole("button", { name: "进入指挥室" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

async function login(page: Page) {
  await loginAs(page, "提督A", "1001");
}

async function expectNoDocumentOverflow(page: Page) {
  await expect(async () => {
    const metrics = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
  }).toPass({ timeout: 5_000 });
}

async function expectNoSeriousAxeIssues(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical")).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await login(page);
});

test("mobile shell stays in bounds and exposes five primary destinations", async ({ page }, testInfo) => {
  await page.goto("/home");
  await expectNoDocumentOverflow(page);

  if (testInfo.project.name === "mobile-390") {
    const navigation = page.getByRole("navigation", { name: "移动端主导航" });
    await expect(navigation).toBeVisible();
    await expect(navigation.getByRole("link")).toHaveCount(4);
    await expect(navigation.getByRole("button", { name: "更多" })).toBeVisible();
  }

  await expectNoSeriousAxeIssues(page);
});

test("boundary viewport matrix has no document overflow or sub-24px targets", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "Run the full boundary matrix once.");
  const cases = [
    { width: 320, height: 568, path: "/home" },
    { width: 360, height: 800, path: "/dashboard" },
    { width: 768, height: 1024, path: "/lock-plan" },
    { width: 1024, height: 768, path: "/strategy" },
    { width: 1280, height: 800, path: "/routine" },
    { width: 1440, height: 900, path: "/home" },
  ];

  for (const viewport of cases) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(viewport.path);
    await page.waitForLoadState("networkidle");
    await expectNoDocumentOverflow(page);
    const tooSmall = await page.evaluate(() => [...document.querySelectorAll("main button, main a, main input, main select, main textarea")].filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && (rect.width < 24 || rect.height < 24);
    }).length);
    expect(tooSmall, `${viewport.width}x${viewport.height} ${viewport.path}`).toBe(0);
  }
});

test("activity scope survives navigation and lock plan has mobile collaboration views", async ({ page }, testInfo) => {
  await page.goto("/home");
  await page.getByRole("button", { name: "建立活动档案" }).click();
  const activityName = `UX-${testInfo.project.name}-${Date.now()}`;
  await page.getByPlaceholder("活动名").fill(activityName);
  await page.getByRole("button", { name: "创建", exact: true }).click();
  await expect(page.getByRole("link", { name: activityName })).toHaveAttribute("aria-current", "page");
  const activityId = new URL(page.url()).searchParams.get("activityId");
  expect(activityId).toBeTruthy();

  const lockPlanLink = ["mobile-390", "tablet-768"].includes(testInfo.project.name)
    ? page.locator('nav[aria-label="移动端主导航"] a[href*="/lock-plan"]')
    : page.locator('header nav a[href*="/lock-plan"]');
  await lockPlanLink.click();
  await expect(page).toHaveURL(new RegExp(`activityId=${activityId}`));
  await expectNoDocumentOverflow(page);

  if (testInfo.project.name === "mobile-390") {
    await expect(page.getByRole("tab", { name: "我的编辑" })).toBeVisible();
    await page.getByRole("tab", { name: "全员概览" }).click();
    await expect(page.locator("summary").filter({ hasText: "提督A" })).toBeVisible();
    await page.getByRole("tab", { name: "冲突" }).click();
    await expect(page.getByText("当前没有重复锁船冲突。")).toBeVisible();
  }
});

test("strategy is activity-only while routine keeps the daily scope", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "Scope regression only needs one desktop viewport.");

  const dailyStrategy = await page.request.post("/api/strategy", {
    data: {
      activityId: null,
      phaseName: "日常",
      title: "不应创建的日常攻略",
      content: "日常攻略内容",
      contentFormat: "markdown",
      status: "published",
    },
  });
  expect(dailyStrategy.status()).toBe(400);
  await expect(dailyStrategy.json()).resolves.toMatchObject({ error: "攻略需要选择活动，日常仅支持作业卡" });

  const activityResponse = await page.request.post("/api/activities", {
    data: { name: `攻略范围验收-${Date.now()}` },
  });
  expect(activityResponse.ok()).toBe(true);

  await page.goto("/strategy");
  await expect(page).toHaveURL(/\/strategy\?activityId=/);
  await expect(page.getByRole("link", { name: "日常", exact: true })).toHaveCount(0);

  await page.goto("/routine");
  await expect(page.getByRole("link", { name: "日常", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "日常作业卡" })).toBeVisible();

  await page.goto("/home");
  await expect(page.getByText("最近作业卡", { exact: true })).toBeVisible();
  await expect(page.getByText("最近攻略", { exact: true })).toHaveCount(0);
  await expect(page.getByText("锁船状态", { exact: true })).toHaveCount(0);
});

test("ship picker keeps focus while an IME composition updates search results", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "IME regression only needs one Chromium viewport.");

  const previousResponse = await page.request.get("/api/users/ship-data");
  const previous = await previousResponse.json() as { shipData?: string };
  const restoreShipData = previous.shipData?.trim() || JSON.stringify({ ships: [], items: [] });
  const suffix = `${testInfo.project.name}-${Date.now()}`;
  const activityResponse = await page.request.post("/api/activities", {
    data: { name: `输入法验收-${suffix}` },
  });
  const activity = await activityResponse.json() as { activity: { id: string } };
  expect(activityResponse.ok()).toBe(true);
  const tagResponse = await page.request.post("/api/lock-tags", {
    data: {
      activityId: activity.activity.id,
      name: `输入法贴条-${suffix}`,
      colorClass: "#d5c6bb",
    },
  });
  expect(tagResponse.ok()).toBe(true);

  const updateResponse = await page.request.put("/api/users/ship-data", {
    data: {
      shipData: JSON.stringify({
        ships: [{ id: 102, lv: 35, st: [] }],
        items: [],
      }),
    },
  });
  expect(updateResponse.ok()).toBe(true);

  await page.goto(`/lock-plan?activityId=${activity.activity.id}`);
  await page.getByText("选船", { exact: true }).first().click();

  const search = page.getByPlaceholder("搜索舰名或 ID");
  await expect(search).toBeVisible();
  await search.click();
  await search.evaluate((element) => {
    element.dispatchEvent(new CompositionEvent("compositionstart", {
      bubbles: true,
      data: "",
    }));
  });
  await search.pressSequentially("qian", { delay: 30 });

  await expect(search).toHaveValue("qian");
  await expect(search).toBeFocused();

  await search.evaluate((element) => {
    element.dispatchEvent(new CompositionEvent("compositionend", {
      bubbles: true,
      data: "千",
    }));
  });
  await search.fill("千");
  await expect(page.getByText("千歳", { exact: true })).toBeVisible();

  await page.request.put("/api/users/ship-data", {
    data: { shipData: restoreShipData },
  });
});

test("copies another user's single lock tag with transient missing-ship hints", async ({ page, browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "Desktop and mobile copy flows share one serial fixture.");

  const sourceContext = await browser.newContext({
    baseURL: "http://127.0.0.1:3100",
  });
  const sourcePage = await sourceContext.newPage();
  await loginAs(sourcePage, "提督B", "1002");

  const previousTargetResponse = await page.request.get("/api/users/ship-data");
  const previousTarget = await previousTargetResponse.json() as { shipData?: string };
  const previousSourceResponse = await sourcePage.request.get("/api/users/ship-data");
  const previousSource = await previousSourceResponse.json() as { shipData?: string };
  const restoreTargetShipData = previousTarget.shipData?.trim() || JSON.stringify({ ships: [], items: [] });
  const restoreSourceShipData = previousSource.shipData?.trim() || JSON.stringify({ ships: [], items: [] });

  const suffix = `${testInfo.project.name}-${Date.now()}`;
  const tagName = `复制验收札-${suffix}`;

  try {
    const activityResponse = await page.request.post("/api/activities", {
      data: { name: `复制验收活动-${suffix}` },
    });
    const activity = await activityResponse.json() as { activity: { id: string } };
    expect(activityResponse.ok()).toBe(true);

    const tagResponse = await page.request.post("/api/lock-tags", {
      data: {
        activityId: activity.activity.id,
        name: tagName,
        colorClass: "#b3383b",
      },
    });
    const tag = await tagResponse.json() as { tag: { id: string } };
    expect(tagResponse.ok()).toBe(true);

    expect((await page.request.put("/api/users/ship-data", {
      data: {
        shipData: JSON.stringify({
          ships: [
            { id: 102, lv: 72, st: [] },
            { id: 104, lv: 40, st: [] },
          ],
          items: [],
        }),
      },
    })).ok()).toBe(true);
    expect((await sourcePage.request.put("/api/users/ship-data", {
      data: {
        shipData: JSON.stringify({
          ships: [
            { id: 102, lv: 75, st: [] },
            { id: 103, lv: 55, st: [] },
          ],
          items: [],
        }),
      },
    })).ok()).toBe(true);

    const sourceAssignments = [
      { uniqueId: "102:0", shipId: 102 },
      { uniqueId: "103:0", shipId: 103 },
    ];
    const originalTargetAssignments = [
      { uniqueId: "104:0", shipId: 104 },
    ];
    expect((await sourcePage.request.post("/api/lock-plan", {
      data: {
        tagId: tag.tag.id,
        assignedData: JSON.stringify(sourceAssignments),
        note: "来源备注",
      },
    })).ok()).toBe(true);
    expect((await page.request.post("/api/lock-plan", {
      data: {
        tagId: tag.tag.id,
        assignedData: JSON.stringify(originalTargetAssignments),
        note: "保留备注",
      },
    })).ok()).toBe(true);

    const waitForPlanSave = () => page.waitForResponse((response) =>
      new URL(response.url()).pathname === "/api/lock-plan" &&
      ["PATCH", "POST"].includes(response.request().method()),
    );
    const getTargetPlan = async () => {
      const response = await page.request.get(`/api/lock-plan?activityId=${activity.activity.id}`);
      const body = await response.json() as {
        plans: Array<{ tagId: string; assignedData: string; note: string | null }>;
      };
      return body.plans.find((plan) => plan.tagId === tag.tag.id);
    };

    await page.goto(`/lock-plan?activityId=${activity.activity.id}`);
    const targetRow = page.locator('[data-testid="lock-plan-user-row"][data-user-name="提督A"]');
    const sourceRow = page.locator('[data-testid="lock-plan-user-row"][data-user-name="提督B"]');
    const visibleUserNames = () => page.locator('[data-testid="lock-plan-user-row"]')
      .evaluateAll((rows) => rows.map((row) => row.getAttribute("data-user-name") ?? ""));
    expect((await visibleUserNames()).indexOf("提督A")).toBeLessThan(
      (await visibleUserNames()).indexOf("提督B"),
    );
    await sourceRow.getByTestId("lock-plan-user-sort-handle")
      .dragTo(targetRow.getByTestId("lock-plan-user-sort-handle"));
    await expect.poll(async () => {
      const names = await visibleUserNames();
      return names.indexOf("提督B") < names.indexOf("提督A");
    }).toBe(true);
    await page.reload();
    await expect.poll(async () => {
      const names = await visibleUserNames();
      return names.indexOf("提督B") < names.indexOf("提督A");
    }).toBe(true);
    await expect(targetRow.getByRole("button", { name: new RegExp(`拷贝${tagName}`) })).toHaveCount(0);

    await sourceRow.getByRole("button", { name: `拷贝${tagName}到我的札` }).click();
    const preview = page.getByRole("alertdialog", { name: "拷贝到我的札" });
    await expect(preview).toBeVisible();
    await expect(preview.getByTestId("copy-preview-来源")).toHaveText("2");
    await expect(preview.getByTestId("copy-preview-匹配")).toHaveText("1");
    await expect(preview.getByTestId("copy-preview-缺船")).toHaveText("1");
    await expect(preview.getByTestId("copy-preview-将替换")).toHaveText("1");

    const desktopSave = waitForPlanSave();
    await preview.getByRole("button", { name: "复制到我的札" }).click();
    expect((await desktopSave).ok()).toBe(true);

    const desktopGhost = targetRow.getByRole("button", { name: /缺少 .+，点击选择替代舰船/ });
    await expect(desktopGhost).toBeVisible();
    await desktopGhost.click();
    const picker = page.getByRole("dialog", { name: "选择舰娘" });
    await expect(picker).toBeVisible();
    const lockedShipCard = picker.locator('[role="button"]').filter({ hasText: "ID 102" }).first();
    await expect(lockedShipCard).toHaveCSS("background-color", "rgb(197, 104, 106)");
    await expect(lockedShipCard).toHaveCSS("color", "rgb(15, 23, 42)");
    await page.keyboard.press("Escape");

    const copiedTargetPlan = await getTargetPlan();
    expect(JSON.parse(copiedTargetPlan?.assignedData ?? "[]")).toEqual([
      { uniqueId: "102:0", shipId: 102 },
      null,
    ]);
    expect(copiedTargetPlan?.note).toBe("保留备注");
    const sourcePlanResponse = await sourcePage.request.get(`/api/lock-plan?activityId=${activity.activity.id}`);
    const sourcePlans = await sourcePlanResponse.json() as {
      plans: Array<{ tagId: string; assignedData: string; note: string | null }>;
    };
    const unchangedSourcePlan = sourcePlans.plans.find((plan) => plan.tagId === tag.tag.id);
    expect(JSON.parse(unchangedSourcePlan?.assignedData ?? "[]")).toEqual(sourceAssignments);
    expect(unchangedSourcePlan?.note).toBe("来源备注");

    const desktopUndo = waitForPlanSave();
    await page.getByRole("button", { name: "撤销复制锁船" }).click();
    expect((await desktopUndo).ok()).toBe(true);
    await expect(desktopGhost).toHaveCount(0);
    expect(JSON.parse((await getTargetPlan())?.assignedData ?? "[]")).toEqual(originalTargetAssignments);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/lock-plan?activityId=${activity.activity.id}`);
    await page.getByRole("tab", { name: "全员概览" }).click();
    const overviewNames = await page.locator("details > summary > span:first-child").allTextContents();
    expect(overviewNames.indexOf("提督B")).toBeLessThan(overviewNames.indexOf("提督A"));
    const sourceDetails = page.locator("details").filter({ hasText: "提督B" });
    await sourceDetails.locator("summary").click();
    await sourceDetails.getByRole("button", { name: `拷贝${tagName}到我的札` }).click();
    const mobileSave = waitForPlanSave();
    await page.getByRole("alertdialog", { name: "拷贝到我的札" })
      .getByRole("button", { name: "复制到我的札" })
      .click();
    expect((await mobileSave).ok()).toBe(true);

    await page.getByRole("tab", { name: "我的编辑" }).click();
    const mobileGhost = page.getByRole("button", { name: /缺少 .+，点击选择替代舰船/ });
    await expect(mobileGhost).toBeVisible();
    await expectNoDocumentOverflow(page);
    await expectNoSeriousAxeIssues(page);

    const mobileUndo = waitForPlanSave();
    await page.getByRole("button", { name: "撤销复制锁船" }).click();
    expect((await mobileUndo).ok()).toBe(true);
    await expect(mobileGhost).toHaveCount(0);

    await page.getByRole("tab", { name: "全员概览" }).click();
    const conflictSourceDetails = page.locator("details").filter({ hasText: "提督B" });
    await conflictSourceDetails.locator("summary").click();
    await conflictSourceDetails.getByRole("button", { name: `拷贝${tagName}到我的札` }).click();
    await page.route("**/api/lock-plan", async (route) => {
      if (route.request().method() === "PATCH") {
        await route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({ error: "测试并发冲突" }),
        });
        return;
      }
      await route.continue();
    }, { times: 1 });
    await page.getByRole("alertdialog", { name: "拷贝到我的札" })
      .getByRole("button", { name: "复制到我的札" })
      .click();
    await expect(page.getByRole("alertdialog", { name: "锁船计划已被更新" })).toBeVisible();
    await page.getByRole("button", { name: "稍后刷新" }).click();
    await page.getByRole("tab", { name: "我的编辑" }).click();
    await expect(page.getByRole("button", { name: /缺少 .+，点击选择替代舰船/ })).toHaveCount(0);
    expect(JSON.parse((await getTargetPlan())?.assignedData ?? "[]")).toEqual(originalTargetAssignments);
  } finally {
    await page.request.put("/api/users/ship-data", {
      data: { shipData: restoreTargetShipData },
    });
    await sourcePage.request.put("/api/users/ship-data", {
      data: { shipData: restoreSourceShipData },
    });
    await sourceContext.close();
  }
});

test("routine cards preserve strike and combined fleet layouts", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "Fleet layout regression only needs one desktop viewport.");

  const suffix = `${testInfo.project.name}-${Date.now()}`;
  const ship = (id: number) => ({ id, lv: 90 + id % 10, luck: 0, items: {} });
  const fleet = (startId: number, count: number, fleetType?: number) => {
    const value: Record<string, unknown> = fleetType ? { t: fleetType } : {};
    for (let index = 0; index < count; index++) value[`s${index + 1}`] = ship(startId + index);
    return value;
  };
  const createdIds: string[] = [];

  try {
    const combinedResponse = await page.request.post("/api/routine", {
      data: {
        seaArea: "E2",
        missionName: `联合舰队验收-${suffix}`,
        airControl: 0,
        fleetData: JSON.stringify({ version: 4, f1: fleet(1, 6, 2), f2: fleet(101, 6, 2) }),
      },
    });
    expect(combinedResponse.ok()).toBe(true);
    createdIds.push((await combinedResponse.json()).record.id);

    const strikeResponse = await page.request.post("/api/routine", {
      data: {
        seaArea: "E1",
        missionName: `游击舰队验收-${suffix}`,
        airControl: 0,
        fleetData: JSON.stringify({ version: 4, f1: fleet(201, 7) }),
      },
    });
    expect(strikeResponse.ok()).toBe(true);
    createdIds.push((await strikeResponse.json()).record.id);

    await page.goto("/routine");

    const combinedCard = page.getByTestId("routine-record-card").filter({ hasText: `联合舰队验收-${suffix}` });
    await expect(combinedCard.getByText("第一舰队", { exact: true })).toBeVisible();
    await expect(combinedCard.getByText("第二舰队", { exact: true })).toBeVisible();
    await combinedCard.getByRole("button", { name: "查看" }).click();
    await expect(page.getByTestId("fleet-kind")).toHaveText("联合舰队 · 6+6艘");
    await expect(page.getByTestId("fleet-group-f1").getByTestId("fleet-ship-card")).toHaveCount(6);
    await expect(page.getByTestId("fleet-group-f2").getByTestId("fleet-ship-card")).toHaveCount(6);
    await expectNoDocumentOverflow(page);

    await page.getByRole("button", { name: "← 返回列表" }).click();
    const strikeCard = page.getByTestId("routine-record-card").filter({ hasText: `游击舰队验收-${suffix}` });
    await expect(strikeCard.getByText("游击舰队", { exact: true })).toBeVisible();
    await strikeCard.getByRole("button", { name: "查看" }).click();
    await expect(page.getByTestId("fleet-kind")).toHaveText("游击舰队 · 7艘");
    await expect(page.getByTestId("fleet-group-f1").getByTestId("fleet-ship-card")).toHaveCount(7);
    await expectNoDocumentOverflow(page);
  } finally {
    for (const id of createdIds) await page.request.delete(`/api/routine?id=${id}`);
  }
});

test("dirty strategy draft is guarded by an accessible focus-trapped dialog", async ({ page }, testInfo) => {
  const suffix = `${testInfo.project.name}-${Date.now()}`;
  const activityResponse = await page.request.post("/api/activities", {
    data: { name: `未保存攻略-${suffix}` },
  });
  const activity = await activityResponse.json() as { activity: { id: string } };
  expect(activityResponse.ok()).toBe(true);
  const mapResponse = await page.request.post("/api/strategy/maps", {
    data: { activityId: activity.activity.id, code: "E1" },
  });
  const strategyMap = await mapResponse.json() as { map: { id: string } };
  expect(mapResponse.ok()).toBe(true);
  const sectionResponse = await page.request.post("/api/strategy/sections", {
    data: { strategyMapId: strategyMap.map.id, name: "P1", lockTagIds: [] },
  });
  expect(sectionResponse.ok()).toBe(true);
  const openResponse = await page.request.patch("/api/strategy/maps", {
    data: {
      id: strategyMap.map.id,
      activityId: activity.activity.id,
      code: "E1",
      sortOrder: 0,
      isOpenForPosts: true,
      isDeleted: false,
    },
  });
  expect(openResponse.ok()).toBe(true);

  await page.goto(`/strategy?activityId=${activity.activity.id}`);
  await page.getByRole("button", { name: "写我的攻略" }).click();
  const editor = page.locator('.strategy-editor-canvas [contenteditable="true"]');
  await editor.click();
  await page.keyboard.insertText("尚未保存的活动攻略");
  const homeLink = ["mobile-390", "tablet-768"].includes(testInfo.project.name)
    ? page.locator('nav[aria-label="移动端主导航"] a[href^="/home"]')
    : page.locator('header nav a[href^="/home"]');
  await homeLink.click();

  const dialog = page.getByRole("alertdialog", { name: "切换前处理未保存内容" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "保存并切换" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "放弃并切换" })).toBeVisible();

  for (let index = 0; index < 8; index += 1) await page.keyboard.press("Tab");
  expect(await page.evaluate(() => !!document.activeElement?.closest('[role="alertdialog"]'))).toBe(true);
  await expectNoSeriousAxeIssues(page);
});

test("all games render without emoji assets or spending test food", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "Desktop keyboard smoke test only.");
  await page.route("**/api/games/start", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ food: 10 }) });
  });
  await page.goto("/profile");

  for (const title of ["鼠输送", "舰队决战", "对空射击"]) {
    const card = page.locator(".surface-panel-subtle").filter({ hasText: title });
    await card.getByRole("button", { name: "开始（粮食 -1）" }).click();
    await expect(page.locator("canvas")).toBeVisible();
    await page.getByRole("button", { name: "关闭" }).click();
    await expect(page.locator("canvas")).toHaveCount(0);
  }
});
