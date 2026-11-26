import assert from "node:assert/strict";
import { chromium, type Page } from "playwright";
import { mkdir } from "node:fs/promises";

export async function verifyBrowser(base: string, visualOnly = false) {
  const browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.CHROME_EXECUTABLE ??
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const errors: string[] = [];
  const screenshots: { path: string; width: number; height: number }[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (/hydration.*mismatch|hydration completed/i.test(message.text()))
      errors.push(`${page.url()}: ${message.text()}`);
  });
  await mkdir(".verification/day3/screens", { recursive: true });
  async function goto(path: string) {
    await page.goto(base + path, { waitUntil: "networkidle" });
  }
  async function noOverflow() {
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `Horizontal overflow at ${page.url()}`,
    );
  }
  async function capture(name: string) {
    await page.evaluate(() => document.fonts.ready);
    await noOverflow();
    const path = `.verification/day3/screens/${name}.png`;
    await page.screenshot({ path, fullPage: true });
    screenshots.push({
      path,
      width: page.viewportSize()!.width,
      height: await page.evaluate(() => document.documentElement.scrollHeight),
    });
  }
  let createdId: number | undefined;
  let debounceRequests = 0;
  try {
    for (const width of [360, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      for (const [name, path] of Object.entries({
        home: "/",
        login: "/login",
        dashboard: "/dashboard",
        requests: "/requests",
        detail: "/requests/1043",
        profile: "/profile",
      })) {
        await goto(path);
        await capture(`${name}-${width}`);
      }
      await goto("/requests/1042?scenario=long");
      await capture(`long-detail-${width}`);
      await goto("/requests?scenario=missing-fields");
      assert.ok(
        (await page.locator("body").innerText()).includes("Без названия"),
      );
      await capture(`missing-fields-${width}`);
    }
    for (const [name, path] of Object.entries({
      empty: "/requests?q=unfindable-123456789",
      error500: "/requests?scenario=500",
      error429: "/requests?scenario=429",
      detailError: "/requests/1042?scenario=500",
      search: "/requests?q=CRM",
      page2: "/requests?page=2",
      oldest: "/requests?sort=oldest",
    })) {
      await goto(path);
      await capture(name);
    }
    console.log(
      `OK responsive: ${screenshots.length} screens at 360, 768 and 1280 px`,
    );
    if (visualOnly) {
      assert.deepEqual(errors, []);
      return { screenshots, errors, debounceRequests, createdId };
    }

    await page.setViewportSize({ width: 360, height: 900 });
    await goto("/dashboard");
    await page
      .getByRole("button", { name: "Открыть меню", exact: true })
      .click();
    await page
      .locator("dialog[open]")
      .getByRole("link", { name: "Заявки", exact: true })
      .click();
    await page.locator(".request-list").waitFor({ state: "visible" });
    assert.equal(await page.locator("dialog[open]").count(), 0);
    await page.setViewportSize({ width: 1280, height: 900 });
    await goto("/requests");
    const calls: string[] = [];
    const track = (request: { url(): string }) => {
      const url = new URL(request.url());
      if (url.pathname === "/api/requests") calls.push(url.search);
    };
    page.on("request", track);
    await page
      .getByLabel("Поиск", { exact: true })
      .pressSequentially("CRM", { delay: 60 });
    await page.waitForTimeout(150);
    assert.equal(calls.length, 0, "Search fetched before debounce elapsed");
    await page.waitForURL((url) => url.searchParams.get("q") === "CRM");
    await page.locator(".search-summary").waitFor();
    await page.waitForLoadState("networkidle");
    assert.equal(
      calls.length,
      1,
      `Expected one debounced API request: ${calls.join(", ")}`,
    );
    debounceRequests = calls.length;
    page.off("request", track);
    assert.ok(calls[0]?.includes("q=CRM"));
    await goto("/requests");
    await page.getByLabel("Поиск", { exact: true }).fill("CRM");
    await page.getByLabel("Статус", { exact: true }).selectOption("new");
    assert.equal(
      await page.getByLabel("Поиск", { exact: true }).inputValue(),
      "CRM",
      "Filter change erased pending search",
    );
    await page.waitForURL(
      (url) =>
        url.searchParams.get("q") === "CRM" &&
        url.searchParams.get("status") === "new",
    );
    await goto("/requests?q=CRM&status=in_progress&priority=high&sort=oldest");
    assert.equal(
      await page.getByLabel("Поиск", { exact: true }).inputValue(),
      "CRM",
    );
    assert.equal(
      await page.getByLabel("Статус", { exact: true }).inputValue(),
      "in_progress",
    );
    assert.equal(
      await page.getByLabel("Приоритет", { exact: true }).inputValue(),
      "high",
    );
    assert.equal(
      await page.locator(".desktop-request-list .request-row").count(),
      1,
    );
    await page.reload({ waitUntil: "networkidle" });
    assert.equal(
      await page.getByLabel("Сортировка", { exact: true }).inputValue(),
      "oldest",
    );
    await goto("/requests?page=2");
    assert.equal(
      await page
        .locator(".desktop-request-list .request-row .request-id")
        .first()
        .innerText(),
      "#1031",
    );
    await page.getByRole("button", { name: "Далее", exact: true }).click();
    await page.waitForURL((url) => url.searchParams.get("page") === "3");
    await page.goBack({ waitUntil: "networkidle" });
    assert.equal(new URL(page.url()).searchParams.get("page"), "2");
    await page.reload({ waitUntil: "networkidle" });
    assert.equal(
      await page
        .getByRole("button", { name: "Страница 2", exact: true })
        .getAttribute("aria-current"),
      "page",
    );
    await goto("/requests?q=unfindable-123456789");
    await page
      .getByRole("heading", { name: "Ничего не найдено", exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Сбросить фильтры", exact: true })
      .click();
    await page.locator(".request-list").waitFor();
    assert.equal(new URL(page.url()).search, "");
    console.log(
      "OK debounce, direct links, reload, pagination, Back and empty reset",
    );

    await goto("/dashboard");
    await page.route("**/api/requests?*", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });
    await page.getByRole("link", { name: "Заявки", exact: true }).click();
    await page
      .getByRole("status", { name: "Загрузка заявок", exact: true })
      .waitFor();
    await capture("list-loading");
    await page.locator(".request-list").waitFor();
    await page.unroute("**/api/requests?*");
    for (const code of [500, 429]) {
      let failures = 0;
      await page.route("**/api/requests?*", async (route) => {
        if (!failures++)
          await route.fulfill({
            status: code,
            contentType: "application/json",
            headers: code === 429 ? { "retry-after": "1" } : {},
            body: JSON.stringify({
              statusCode: code,
              statusMessage: "Temporary test failure",
            }),
          });
        else await route.continue();
      });
      await page
        .getByLabel("Приоритет", { exact: true })
        .selectOption(code === 500 ? "urgent" : "high");
      await page
        .getByRole("heading", {
          name: "Не удалось загрузить заявки",
          exact: true,
        })
        .waitFor();
      if (code === 429)
        assert.ok(
          (await page.locator("body").innerText()).includes(
            "Слишком много запросов",
          ),
        );
      const failedUrl = page.url();
      assert.equal(failures, 1, "Unexpected automatic retry");
      await page
        .getByRole("button", { name: "Повторить загрузку", exact: true })
        .click();
      await page.locator(".request-list").waitFor();
      assert.equal(page.url(), failedUrl, "Retry lost filters");
      assert.equal(failures, 2);
      await page.unroute("**/api/requests?*");
    }
    await goto("/requests/1042?scenario=500");
    await page
      .getByRole("button", { name: "Повторить загрузку", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Не работает доступ к CRM", exact: true })
      .waitFor();
    await goto("/requests");
    await page.route("**/api/requests/1042*", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });
    await page
      .locator(".desktop-request-list")
      .getByRole("link", { name: "Не работает доступ к CRM", exact: true })
      .click();
    await page
      .getByRole("status", { name: "Загрузка заявки", exact: true })
      .waitFor();
    await capture("detail-loading");
    await page
      .getByRole("heading", { name: "Не работает доступ к CRM", exact: true })
      .waitFor();
    await page.unroute("**/api/requests/1042*");
    console.log(
      "OK list/detail skeleton, HTTP 429/500, manual retry preserves filters",
    );

    await page.setViewportSize({ width: 360, height: 900 });
    await goto("/requests");
    const create = page.getByRole("button", {
      name: "Создать заявку",
      exact: true,
    });
    await create.click();
    const dialog = page.locator("dialog[open]");
    assert.equal(
      await page.evaluate(() => document.activeElement?.tagName),
      "INPUT",
    );
    for (let index = 0; index < 16; index++) {
      await page.keyboard.press("Tab");
      assert.ok(
        await page.evaluate(() =>
          Boolean(document.activeElement?.closest("dialog[open]")),
        ),
      );
    }
    await page.keyboard.press("Escape");
    assert.equal(
      await page.evaluate(() => document.activeElement?.textContent?.trim()),
      "Создать заявку",
    );
    await create.click();
    await dialog
      .getByLabel(/Название заявки/)
      .fill("Проверка API третьего дня");
    await dialog
      .getByLabel(/^Описание/)
      .fill("Заявка сохраняется на сервере и доступна после перезапуска.");
    await dialog
      .getByRole("button", { name: "Создать заявку", exact: true })
      .click();
    await page.waitForURL((url) => /^\/requests\/\d+$/.test(url.pathname));
    createdId = Number(new URL(page.url()).pathname.split("/").at(-1));
    assert.ok(createdId > 1043);
    await page
      .getByLabel("Ваш комментарий", { exact: true })
      .fill("Комментарий через API");
    await page
      .getByRole("button", { name: "Отправить комментарий", exact: true })
      .click();
    await page.getByText("Комментарий через API", { exact: true }).waitFor();
    await page
      .getByLabel("Исполнитель", { exact: true })
      .selectOption("user-3");
    await page
      .locator(".detail-badges")
      .getByText("Назначена", { exact: true })
      .waitFor();
    await page.reload({ waitUntil: "networkidle" });
    assert.ok(
      (await page.locator(".comments-panel").innerText()).includes(
        "Комментарий через API",
      ),
    );
    await goto("/profile");
    await page.getByLabel("Имя", { exact: true }).fill("Тестовый Пользователь");
    await page
      .getByRole("button", { name: "Сохранить изменения", exact: true })
      .click();
    await page.reload({ waitUntil: "networkidle" });
    assert.equal(
      await page.getByLabel("Имя", { exact: true }).inputValue(),
      "Тестовый Пользователь",
    );
    await noOverflow();
    assert.deepEqual(errors, []);
    console.log(
      "OK keyboard, API create/comment/assignment, reload persistence, profile and no client errors",
    );
    return { screenshots, errors, debounceRequests, createdId };
  } catch (error) {
    await page.screenshot({
      path: ".verification/day3/failure.png",
      fullPage: true,
    });
    console.error((await page.locator("body").innerText()).slice(0, 2000));
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
}
