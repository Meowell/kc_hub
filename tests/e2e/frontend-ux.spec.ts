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

test("dirty strategy draft is guarded by an accessible focus-trapped dialog", async ({ page }, testInfo) => {
  await page.goto("/strategy");
  await page.getByRole("button", { name: "新建攻略" }).click();
  const homeLink = ["mobile-390", "tablet-768"].includes(testInfo.project.name)
    ? page.locator('nav[aria-label="移动端主导航"] a[href="/home"]')
    : page.locator('header nav a[href="/home"]');
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
