import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const emptyDocument = JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] });

async function login(page: Page, name = "提督A", pin = "1001") {
  await page.goto("/login");
  await page.getByLabel("用户名").fill(name);
  await page.getByLabel("PIN 码").fill(pin);
  await page.getByRole("button", { name: "进入指挥室" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

async function postJson(request: APIRequestContext, url: string, data: unknown) {
  const response = await request.post(url, { data });
  const body = await response.json();
  expect(response.ok(), `${url}: ${JSON.stringify(body)}`).toBe(true);
  return body;
}

test("activity strategy sections enforce publication, ownership and map gates", async ({ page, browser }, testInfo) => {
  await login(page);
  const suffix = `${testInfo.project.name}-${Date.now()}`;
  const activity = (await postJson(page.request, "/api/activities", { name: `攻略验收-${suffix}` })).activity;
  const otherActivity = (await postJson(page.request, "/api/activities", { name: `跨活动-${suffix}` })).activity;
  const mainTag = (await postJson(page.request, "/api/lock-tags", {
    activityId: activity.id,
    name: `第三十一战队-${suffix}`,
    colorClass: "#d5c6bb",
  })).tag;
  const foreignTag = (await postJson(page.request, "/api/lock-tags", {
    activityId: otherActivity.id,
    name: `外部贴条-${suffix}`,
    colorClass: "bg-red-200",
  })).tag;
  const routine = (await postJson(page.request, "/api/routine", {
    activityId: activity.id,
    seaArea: "E1",
    missionName: `验收作业-${suffix}`,
    airControl: 123,
    note: "实时引用",
  })).record;
  const replacementRoutine = (await postJson(page.request, "/api/routine", {
    activityId: activity.id,
    seaArea: "E1",
    missionName: `替换作业-${suffix}`,
    airControl: 144,
    note: "替换目标",
  })).record;
  const e1 = (await postJson(page.request, "/api/strategy/maps", { activityId: activity.id, code: "E1" })).map;
  const e2 = (await postJson(page.request, "/api/strategy/maps", { activityId: activity.id, code: "E2" })).map;

  const sections: Record<string, { id: string }> = {};
  for (const name of ["解密1", "P1", "解密2", "P2"]) {
    sections[name] = (await postJson(page.request, "/api/strategy/sections", {
      strategyMapId: e1.id,
      name,
      lockTagIds: [mainTag.id],
    })).section;
  }
  const e2Section = (await postJson(page.request, "/api/strategy/sections", {
    strategyMapId: e2.id,
    name: "P1",
    lockTagIds: [mainTag.id],
  })).section;

  const crossTagResponse = await page.request.post("/api/strategy/sections", {
    data: { strategyMapId: e1.id, name: "非法贴条", lockTagIds: [foreignTag.id] },
  });
  expect(crossTagResponse.status()).toBe(400);

  const openResponse = await page.request.patch("/api/strategy/maps", {
    data: { id: e1.id, activityId: activity.id, code: "E1", sortOrder: 0, isOpenForPosts: true, isDeleted: false },
  });
  expect(openResponse.ok()).toBe(true);

  const closedCreate = await page.request.post("/api/strategy", {
    data: {
      activityId: activity.id,
      sectionId: e2Section.id,
      content: emptyDocument,
      contentFormat: "tiptap-json-v1",
      status: "draft",
      plainText: "",
    },
  });
  expect(closedCreate.status()).toBe(403);

  await page.goto(`/strategy?activityId=${activity.id}`);
  await expect(page.getByRole("button", { name: "E1 解密1" })).toBeVisible();
  await expect(page.getByRole("button", { name: "E1 P2" })).toBeVisible();
  await expect(page.getByText("E2").first()).toBeVisible();
  await page.getByRole("button", { name: "写我的攻略" }).click();
  const editor = page.locator('.strategy-editor-canvas [contenteditable="true"]');
  await expect(editor).toBeVisible();
  await editor.click();
  await page.keyboard.insertText("E1 解密验收：带对潜支援。");

  await editor.evaluate((element) => {
    const imageBytes = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nSIAAAAASUVORK5CYII="), (character) => character.charCodeAt(0));
    const transfer = new DataTransfer();
    transfer.items.add(new File([imageBytes], "map-1.png", { type: "image/png" }));
    transfer.items.add(new File([imageBytes], "map-2.png", { type: "image/png" }));
    element.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: transfer }));
  });
  await expect(page.locator('.strategy-editor-canvas [data-strategy-columns="2"]')).toHaveCount(1);
  await expect(page.locator('.strategy-editor-canvas img[data-upload-state="ready"]')).toHaveCount(2, { timeout: 15_000 });

  await editor.evaluate((element) => {
    const transfer = new DataTransfer();
    transfer.setData("text/html", '<table><tbody><tr><td rowspan="2" style="background-color:#164e63;color:#ffffff;font-weight:bold">节点</td><td>阵型</td></tr><tr><td style="color:#f87171">警戒</td></tr></tbody></table>');
    transfer.setData("text/plain", "节点\t阵型\n\t警戒");
    element.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: transfer }));
  });
  await expect(page.locator(".strategy-editor-canvas table")).toHaveCount(1);
  await expect(page.locator('.strategy-editor-canvas td[rowspan="2"]')).toHaveCount(1);

  const routineChoice = page.locator(".strategy-assets-panel button").filter({ hasText: routine.missionName });
  await expect(routineChoice).toHaveCount(1);
  await routineChoice.click();
  await expect(page.locator(".strategy-routine-card").filter({ hasText: routine.missionName })).toBeVisible();
  await expect(page.getByText("已自动保存")).toBeVisible({ timeout: 10_000 });

  const adminMaps = await (await page.request.get(`/api/strategy/maps?activityId=${activity.id}`)).json();
  const draft = adminMaps.maps[0].sections.find((section: { id: string }) => section.id === sections["解密1"].id).posts[0];
  expect(draft.status).toBe("draft");
  expect(draft.plainText).toContain("E1 解密验收");

  const memberContext = await browser.newContext();
  const memberPage = await memberContext.newPage();
  await login(memberPage, "提督C", "1003");
  await memberPage.goto(`/strategy?activityId=${activity.id}`);
  await expect(memberPage.getByText("E1 解密验收：带对潜支援。")).toHaveCount(0);

  await page.getByRole("button", { name: "发布" }).click();
  await expect(page.getByText("已发布")).toBeVisible({ timeout: 10_000 });
  await memberPage.reload();
  await expect(memberPage.getByText("E1 解密验收：带对潜支援。")).toBeVisible();

  const guideOutline = page.getByRole("navigation", { name: "攻略分块目录" });
  const authoredSection = guideOutline.locator('button[data-has-guides="true"]').filter({ hasText: "E1 解密1" });
  const emptySection = guideOutline.locator('button[data-has-guides="false"]').filter({ hasText: "E1 解密2" });
  await expect(authoredSection).toBeVisible();
  await expect(emptySection).toBeVisible();
  await guideOutline.getByRole("button", { name: /E1 P1/ }).click();
  await expect(authoredSection).toHaveClass(/bg-slate-800\/55/);
  await expect(emptySection).not.toHaveClass(/bg-slate-800\/55/);
  await authoredSection.click();

  const updatedRoutineName = `更新作业-${suffix}`;
  const routineUpdate = await page.request.patch("/api/routine", {
    data: {
      id: routine.id,
      activityId: activity.id,
      seaArea: "E1",
      missionName: updatedRoutineName,
      airControl: 123,
      note: "已更新",
    },
  });
  expect(routineUpdate.ok()).toBe(true);
  await memberPage.reload();
  await expect(memberPage.locator(".strategy-routine-card").filter({ hasText: updatedRoutineName })).toBeVisible();
  expect((await page.request.delete(`/api/routine?id=${routine.id}`)).ok()).toBe(true);
  await memberPage.reload();
  await expect(memberPage.getByText("作业卡已不存在")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "选择替换作业卡" }).click();
  const replacementChoice = page.locator(".strategy-assets-panel button").filter({ hasText: replacementRoutine.missionName });
  await expect(replacementChoice).toHaveCount(1);
  await replacementChoice.click();
  await expect(page.locator(".strategy-routine-card").filter({ hasText: replacementRoutine.missionName })).toBeVisible();
  await expect(page.getByText("已自动保存")).toBeVisible({ timeout: 10_000 });

  const duplicate = await page.request.post("/api/strategy", {
    data: {
      activityId: activity.id,
      sectionId: sections["解密1"].id,
      content: emptyDocument,
      contentFormat: "tiptap-json-v1",
      status: "draft",
      plainText: "",
    },
  });
  expect(duplicate.status()).toBe(409);

  const disposable = (await postJson(page.request, "/api/strategy", {
    activityId: activity.id,
    sectionId: sections.P1.id,
    content: emptyDocument,
    contentFormat: "tiptap-json-v1",
    status: "draft",
    plainText: "",
  })).post;
  expect((await page.request.delete(`/api/strategy?id=${disposable.id}`)).ok()).toBe(true);
  const restored = (await postJson(page.request, "/api/strategy", {
    activityId: activity.id,
    sectionId: sections.P1.id,
    content: emptyDocument,
    contentFormat: "tiptap-json-v1",
    status: "draft",
    plainText: "",
  })).post;
  expect(restored.id).toBe(disposable.id);
  expect(restored.revision).toBe(1);

  const closeResponse = await page.request.patch("/api/strategy/maps", {
    data: { id: e1.id, activityId: activity.id, code: "E1", sortOrder: 0, isOpenForPosts: false, isDeleted: false },
  });
  expect(closeResponse.ok()).toBe(true);
  await page.reload();
  await expect(page.getByText("海图整理中")).toBeVisible();
  await expect(page.locator('.strategy-editor-canvas [contenteditable="true"]')).toHaveCount(0);
  await expect(page.getByText("E1 解密验收：带对潜支援。")).toBeVisible();

  const closedEdit = await page.request.patch("/api/strategy", {
    data: {
      id: draft.id,
      activityId: activity.id,
      sectionId: sections["解密1"].id,
      content: emptyDocument,
      contentFormat: "tiptap-json-v1",
      status: "published",
      revision: draft.revision,
      plainText: "禁止覆盖",
    },
  });
  expect(closedEdit.status()).toBe(403);
  await memberContext.close();
});
