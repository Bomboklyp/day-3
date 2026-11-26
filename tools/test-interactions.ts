import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import type { ApiItem, ApiRequest } from "../shared/types/api";

export async function verifyInteractions(base: string) {
  const browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.CHROME_EXECUTABLE ??
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    reducedMotion: "reduce",
  });
  const errors: string[] = [],
    screenshots: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (/hydration.*mismatch|hydration completed/i.test(message.text()))
      errors.push(message.text());
  });
  await mkdir(".verification/day3/actions", { recursive: true });
  async function get() {
    return (
      (await (
        await fetch(base + "/api/requests/1042")
      ).json()) as ApiItem<ApiRequest>
    ).data;
  }
  async function shot(name: string) {
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({
      path: `.verification/day3/actions/${name}.png`,
      fullPage: true,
    });
    screenshots.push(name);
  }
  try {
    await page.goto(base + "/requests/1042", { waitUntil: "networkidle" });
    await shot("01-detail");
    let release = () => {};
    await page.route("**/api/requests/1042", async (route) => {
      if (route.request().method() === "PATCH")
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      await route.continue();
    });
    await page.getByLabel("Приоритет", { exact: true }).selectOption("urgent");
    await page
      .locator(".detail-badges")
      .getByText("Критический", { exact: true })
      .waitFor();
    assert.equal((await get()).priority, "high");
    await shot("02-optimistic");
    release();
    await page
      .getByRole("heading", {
        name: "Приоритет изменён на «Критический»",
        exact: true,
      })
      .waitFor();
    assert.equal((await get()).priority, "urgent");
    await shot("03-priority-success");
    await page.unroute("**/api/requests/1042");
    await page
      .getByRole("button", { name: "Отменить изменение", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Изменение отменено", exact: true })
      .waitFor();
    assert.equal((await get()).priority, "high");
    await shot("04-priority-undo");
    await page.route("**/api/requests/1042", async (route) => {
      if (route.request().method() === "PATCH") {
        await new Promise((resolve) => setTimeout(resolve, 700));
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ statusCode: 500 }),
        });
      } else await route.continue();
    });
    await page.getByLabel("Приоритет", { exact: true }).selectOption("low");
    await page
      .locator(".detail-badges")
      .getByText("Низкий", { exact: true })
      .waitFor();
    await page
      .getByRole("heading", { name: "Изменение не сохранено", exact: true })
      .waitFor();
    assert.equal(
      await page.getByLabel("Приоритет", { exact: true }).inputValue(),
      "high",
    );
    assert.equal((await get()).priority, "high");
    await shot("05-rollback-500");
    await page.unroute("**/api/requests/1042");
    const current = await get();
    const remote = await fetch(base + "/api/requests/1042", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        status: "waiting",
        expected_revision: current.revision ?? 1,
      }),
    });
    assert.equal(remote.status, 200);
    await page.getByLabel("Приоритет", { exact: true }).selectOption("urgent");
    await page.getByText(/Данные заявки уже изменились/).waitFor();
    assert.equal((await get()).priority, "high");
    await shot("06-conflict-409");
    await page
      .getByRole("button", { name: "Обновить заявку", exact: true })
      .click();
    await page
      .locator(".detail-badges")
      .getByText("Ожидание", { exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Изменить статус", exact: true })
      .click();
    const dialog = page.locator("dialog[open]");
    await dialog.getByLabel("Статус", { exact: true }).selectOption("resolved");
    await dialog
      .getByRole("button", { name: "Сохранить изменения", exact: true })
      .click();
    await page
      .locator(".detail-badges")
      .getByText("Решена", { exact: true })
      .waitFor();
    await shot("07-status-success");
    await page.getByRole("link", { name: "Обзор", exact: true }).click();
    await page
      .getByRole("button", { name: "Отменить изменение", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Отменить изменение", exact: true })
      .waitFor({ state: "hidden" });
    const totals = (await (await fetch(base + "/api/requests")).json()) as {
      stats: { waiting: number };
    };
    assert.equal(
      Number(
        await page
          .locator(".stat-card")
          .filter({ hasText: "Ожидают ответа" })
          .locator(".stat-value")
          .innerText(),
      ),
      totals.stats.waiting,
    );
    await page.goto(base + "/requests/1042", { waitUntil: "networkidle" });
    await page
      .locator(".detail-badges")
      .getByText("Ожидание", { exact: true })
      .waitFor();
    assert.equal((await get()).status, "waiting");
    const assigned = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/requests/1042") &&
        response.request().method() === "PATCH",
    );
    await page
      .getByLabel("Исполнитель", { exact: true })
      .selectOption("user-4");
    assert.equal((await assigned).status(), 200);
    await page.waitForTimeout(100);
    assert.equal((await get()).assignee_id, "user-4");
    assert.equal((await get()).status, "waiting");
    const removeAssignee = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/requests/1042") &&
        response.request().method() === "PATCH",
    );
    await page.getByLabel("Исполнитель", { exact: true }).selectOption("");
    await removeAssignee;
    assert.equal((await get()).assignee_id, null);
    const restoreAssignee = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/requests/1042") &&
        response.request().method() === "PATCH",
    );
    await page
      .getByLabel("Исполнитель", { exact: true })
      .selectOption("user-4");
    await restoreAssignee;
    await page.reload({ waitUntil: "networkidle" });
    await page
      .getByLabel("Ваш комментарий", { exact: true })
      .fill("Уточнила детали заявки.");
    await shot("08-comment-filled");
    await page.route("**/api/requests/1042/comments", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: "{}",
      });
    });
    await page
      .getByRole("button", { name: "Отправить комментарий", exact: true })
      .click();
    await page.getByText("Отправляем комментарий…", { exact: true }).waitFor();
    await shot("09-comment-sending");
    await page
      .getByRole("button", { name: "Повторить отправку", exact: true })
      .waitFor();
    assert.equal(
      await page.getByLabel("Ваш комментарий", { exact: true }).inputValue(),
      "Уточнила детали заявки.",
    );
    await shot("10-comment-error");
    await page.unroute("**/api/requests/1042/comments");
    await page
      .getByRole("button", { name: "Повторить отправку", exact: true })
      .click();
    await page.getByText("Уточнила детали заявки.", { exact: true }).waitFor();
    assert.equal(
      (await get()).comments?.filter(
        (comment) => comment.text === "Уточнила детали заявки.",
      ).length,
      1,
    );
    await shot("11-comment-sent");
    await page.getByLabel("Приоритет", { exact: true }).selectOption("urgent");
    await page
      .getByRole("heading", {
        name: "Приоритет изменён на «Критический»",
        exact: true,
      })
      .waitFor();
    await page.getByRole("link", { name: "Обзор", exact: true }).click();
    await page
      .getByRole("button", { name: "Отменить изменение", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Отменить изменение", exact: true })
      .waitFor({ state: "hidden" });
    assert.equal((await get()).priority, "high");
    assert.ok(
      (await get()).comments?.some(
        (comment) => comment.text === "Уточнила детали заявки.",
      ),
    );
    await page.goto(base + "/profile", { waitUntil: "networkidle" });
    await page
      .getByLabel("Плотность списка", { exact: true })
      .selectOption("compact");
    await page.reload({ waitUntil: "networkidle" });
    assert.equal(
      await page.getByLabel("Плотность списка", { exact: true }).inputValue(),
      "compact",
    );
    await shot("12-profile-compact");
    await page.goto(base + "/requests", { waitUntil: "networkidle" });
    await page
      .getByText("Плотность списка: компактная", { exact: true })
      .waitFor();
    const row = await page.locator(".request-row").first().boundingBox();
    assert.ok(row && row.height < 54);
    await shot("13-list-compact");
    await page.setViewportSize({ width: 360, height: 900 });
    await page.goto(base + "/requests/1042", { waitUntil: "networkidle" });
    await page
      .getByRole("button", { name: "Изменить статус", exact: true })
      .click();
    for (let index = 0; index < 8; index++) {
      await page.keyboard.press("Tab");
      assert.ok(
        await page.evaluate(() =>
          Boolean(document.activeElement?.closest("dialog[open]")),
        ),
      );
    }
    await shot("14-status-mobile");
    await page.keyboard.press("Escape");
    assert.equal(
      await page.evaluate(() => document.activeElement?.textContent?.trim()),
      "Изменить статус",
    );
    assert.deepEqual(errors, []);
    console.log(
      "OK Day 3: optimistic update, rollback 500, conflict 409, Undo, assignment, comment retry, density and keyboard",
    );
    return {
      screenshots,
      errors,
      optimistic: true,
      rollback: [409, 500],
      undo: true,
      density: true,
    };
  } catch (error) {
    await page.screenshot({
      path: ".verification/day3/actions/failure.png",
      fullPage: true,
    });
    console.error((await page.locator("body").innerText()).slice(0, 1800));
    throw error;
  } finally {
    await browser.close();
  }
}
