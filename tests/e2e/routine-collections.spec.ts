import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("用户名").fill("提督A");
  await page.getByLabel("PIN 码").fill("1001");
  await page.getByRole("button", { name: "进入指挥室" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test("作业合集保存次数进度并适配桌面与移动端", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "Use one project and resize it for the viewport matrix.");
  await login(page);
  await page.request.delete("/api/routine-collections/progress?collectionKey=seasonal-month-v1");

  await page.goto("/routine");
  await page.getByRole("link", { name: "作业合集" }).click();
  await expect(page).toHaveURL(/view=collections/);
  await expect(page.getByRole("heading", { name: "日常作业合集" })).toBeVisible();
  await expect(page.getByTestId("routine-collection-step")).toHaveCount(35);
  await expect(page.getByRole("progressbar", { name: "作业合集总进度" })).toHaveAttribute("aria-valuenow", "0");

  const firstStep = page.getByTestId("routine-collection-step").filter({ has: page.getByRole("heading", { name: "3-1", exact: true }) });
  const firstCheckbox = firstStep.getByRole("checkbox");
  await firstCheckbox.click();
  await expect(firstCheckbox).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("progressbar", { name: "作业合集总进度" })).toHaveAttribute("aria-valuenow", "3");

  const repeatStep = page.locator('[data-step-key="10-1-6"]');
  await repeatStep.getByRole("button", { name: "1-6 增加一次完成记录" }).click();
  await expect(repeatStep.getByText("1/2", { exact: true })).toBeVisible();
  await repeatStep.getByRole("button", { name: "1-6 增加一次完成记录" }).click();
  await expect(repeatStep.getByText("2/2", { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.locator('[data-step-key="01-3-1"]').getByRole("checkbox")).toHaveAttribute("aria-checked", "true");
  await expect(page.locator('[data-step-key="10-1-6"]').getByText("2/2", { exact: true })).toBeVisible();

  await firstStep.getByRole("button", { name: "放大查看3-1 阵容" }).click();
  await expect(page.getByRole("dialog", { name: "3-1 阵容" })).toBeVisible();
  await page.getByRole("button", { name: "关闭", exact: true }).click();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("navigation", { name: "作业页面视图" }).getByRole("link", { name: "作业卡" })).toBeVisible();
  const bounds = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.clientWidth);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).include("main").analyze();
  expect(axe.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical")).toEqual([]);

  await page.getByRole("button", { name: "重置进度" }).click();
  await page.getByRole("button", { name: "确认重置" }).click();
  await expect(page.locator('[data-step-key="01-3-1"]').getByRole("checkbox")).toHaveAttribute("aria-checked", "false");
  await expect(page.getByRole("progressbar", { name: "作业合集总进度" })).toHaveAttribute("aria-valuenow", "0");
});
