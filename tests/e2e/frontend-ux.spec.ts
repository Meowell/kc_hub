import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("用户名").fill("提督A");
  await page.getByLabel("PIN 码").fill("1001");
  await page.getByRole("button", { name: "进入指挥室" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
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
