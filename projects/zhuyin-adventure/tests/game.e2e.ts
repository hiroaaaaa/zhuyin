import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
async function parent(page: Page) {
  await page.getByRole("button", { name: /家長專區|家長：查看/ }).click();
  const dialog = page.getByRole("dialog");
  const text = await dialog.innerText();
  const match = text.match(/(\d+) \+ (\d+)/)!;
  await dialog
    .getByRole("textbox")
    .fill(String(Number(match[1]) + Number(match[2])));
  await dialog.getByRole("button", { name: "進入家長專區" }).click();
}
async function markAll(page: Page) {
  await parent(page);
  await page.getByRole("button", { name: "陪玩設定" }).click();
  await page.getByRole("button", { name: "我已確認：37 個都學過" }).click();
  await page.getByRole("button", { name: "返回", exact: true }).click();
  await page.getByRole("button", { name: "開始玩", exact: true }).click();
}
async function ready(page: Page) {
  await expect(page.locator(".board button").first()).toBeEnabled({
    timeout: 30000,
  });
}
async function supportFinish(page: Page, steps = 1) {
  const before = await page.locator(".round-meta").innerText();
  for (let i = 0; i < steps; i++) {
    await ready(page);
    await page.getByRole("button", { name: "小兔幫幫我" }).click();
    await page.getByRole("button", { name: "小兔幫幫我" }).click();
    await page.locator(".board .hinted").click();
    if (i < steps - 1)
      await expect(page.locator(".step-progress")).toContainText("✓");
  }
  await expect
    .poll(
      async () =>
        (await page
          .getByRole("heading", { name: "小冒險完成！", exact: true })
          .isVisible()) ||
        (await page.locator(".round-meta").innerText()) !== before,
      { timeout: 30000 },
    )
    .toBe(true);
  await expect(
    page.getByRole("button", { name: /下一題|領小花貼紙/ }),
  ).toHaveCount(0);
}

test("手機首頁、37 字形、實際聽音及引入持久化", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: /小耳朵，\s*一起去冒險！/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: `test-results/${test.info().project.name}-home.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "開始玩", exact: true }).click();
  await page.getByRole("button", { name: /認識注音/ }).click();
  await expect(page.locator(".catalog button")).toHaveCount(37);
  const loaded = await page
    .locator(".catalog img")
    .evaluateAll((imgs) =>
      imgs.every((i) => (i as HTMLImageElement).naturalWidth > 0),
    );
  expect(loaded).toBe(true);
  await page.getByRole("button", { name: "第 1 組", exact: true }).click();
  await expect(page.locator(".catalog button")).toHaveCount(4);
  await page.getByRole("button", { name: "ㄅ，尚未認識" }).click();
  await expect(page.getByText("聲母・第 1 組")).toBeVisible();
  for (let i = 0; i < 2; i++) {
    await page.getByRole("button", { name: "♪ 聽注音" }).click();
    await expect(page.getByRole("button", { name: "♪ 聽注音" })).toBeEnabled();
  }
  await expect(page.getByRole("status")).toContainText("已加入遊戲");
  await page.reload();
  await expect(page.getByRole("status")).toContainText("已加入遊戲");
  await page.getByRole("button", { name: "找一樣的注音" }).click();
  await page
    .locator(".practice")
    .getByRole("button", { name: "ㄅ", exact: true })
    .click();
  await expect(page.locator(".practice [role=status]")).toContainText("找到了");
  expect(errors).toEqual([]);
});

test("三款作答遊戲、錯答、獎勵與分開紀錄", async ({ page }) => {
  await page.goto("./");
  await markAll(page);
  await page.getByRole("button", { name: /聽音找注音/ }).click();
  await page.getByRole("button", { name: "開始小冒險 →" }).click();
  await ready(page);
  await page.getByRole("button", { name: "小兔幫幫我" }).click();
  await page.getByRole("button", { name: "小兔幫幫我" }).click();
  await page.locator(".board button:not(.hinted)").first().click();
  await expect(page.locator(".board .retry")).toBeVisible();
  await ready(page);
  await page.getByRole("button", { name: "♪ 再聽一次" }).click();
  await ready(page);
  await page.locator(".board .hinted").click();
  await expect(page.locator(".round-meta")).toContainText("第 2 / 5 題");
  for (let i = 1; i < 5; i++) {
    await supportFinish(page);
  }
  await expect(
    page.getByRole("heading", { name: "送你一朵小花！" }),
  ).toBeVisible();
  await expect(page.locator(".result-list")).toContainText("協助後完成");
  await page.getByRole("button", { name: "回遊戲選單" }).click();
  await expect(page.locator(".summary-card")).toContainText("1 張冒險貼紙");
  await page.getByRole("button", { name: /注音九宮格/ }).click();
  await page.getByRole("button", { name: "九格・八方向" }).click();
  await page.getByRole("button", { name: "開始小冒險 →" }).click();
  await ready(page);
  await expect(page.locator(".board button")).toHaveCount(9);
  await supportFinish(page);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: `test-results/${test.info().project.name}-grid.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "返回", exact: true }).click();
  await page.getByRole("button", { name: "回遊戲選單" }).click();
  await page.getByRole("button", { name: /指令小隊長/ }).click();
  await page.getByRole("button", { name: "3 個步驟" }).click();
  await page.getByRole("button", { name: /整段挑戰/ }).click();
  await page.getByRole("button", { name: "開始小冒險 →" }).click();
  await expect(page.locator(".board button").first()).toBeDisabled();
  await supportFinish(page, 3);
  await page.getByRole("button", { name: "返回", exact: true }).click();
  await page.getByRole("button", { name: "回遊戲選單" }).click();
  await page.getByRole("button", { name: "家長：查看進度與設定" }).click();
  await expect(page.locator(".summary-card")).toContainText(
    "獨立完成 0 / 5 題",
  );
  await expect(page.locator("table")).toContainText("指令小隊長");
  await expect(page.locator("table")).toContainText("注音九宮格");
});

async function isolatedOrigin() {
  const assets = new Map<string, Buffer>();
  const root = path.resolve("../../docs");
  async function walk(dir: string) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(file);
      else
        assets.set(
          "/zhuyin/" +
            path.relative(root, file).replaceAll("\\", "/"),
          await readFile(file),
        );
    }
  }
  await walk(root);
  const mime: Record<string, string> = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".css": "text/css",
    ".svg": "image/svg+xml",
    ".mp3": "audio/mpeg",
    ".png": "image/png",
    ".woff2": "font/woff2",
    ".json": "application/json",
  };
  const server = createServer((req, res) => {
    let pathname = new URL(req.url || "/", "http://localhost").pathname;
    if (pathname.endsWith("/")) pathname += "index.html";
    const body = assets.get(pathname);
    res.writeHead(body ? 200 : 404, {
      "Content-Type":
        mime[path.extname(pathname)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(body || "404");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw Error("測試伺服器啟動失敗");
  return {
    url: `http://127.0.0.1:${address.port}/zhuyin/`,
    stop: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
        server.closeAllConnections();
      }),
  };
}

test("離線完整素材、重新開啟與離線語音解碼", async ({
  page,
  context,
  browserName,
}) => {
  const origin = browserName === "webkit" ? await isolatedOrigin() : null;
  if (origin)
    test.info().annotations.push({
      type: "測試範圍",
      description:
        "WebKit 使用伺服器停機驗證快取，非真機斷網；Playwright setOffline 限制 https://github.com/microsoft/playwright/issues/42775",
    });
  await page.goto(origin?.url || "./");
  await expect(
    page.getByText("✓ 離線素材已準備好", { exact: true }),
  ).toBeVisible({ timeout: 60000 });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  if (origin) {
    await origin.stop();
    await expect(fetch(origin.url)).rejects.toThrow();
  } else await context.setOffline(true);
  const response = await page.reload();
  expect(response?.fromServiceWorker()).toBe(true);
  await expect(
    page.getByRole("button", { name: "開始玩", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "開始玩", exact: true }).click();
  await page.getByRole("button", { name: /認識注音/ }).click();
  await page.getByRole("button", { name: "ㄩ，尚未認識" }).click();
  await page.getByRole("button", { name: "♪ 聽注音" }).click();
  await expect(page.getByRole("status")).toContainText("再聽 1 次");
  const decoded = await page.evaluate(async () => {
    const c = new AudioContext();
    const clips = Array.from(
      { length: 37 },
      (_, i) => `symbols/s${String(i + 1).padStart(2, "0")}`,
    );
    clips.push("voice/first", "voice/dir-ul", "voice/abs-8");
    const advanced = await (await fetch("audio/advanced/texts.json")).json();
    clips.push(
      ...Object.keys(advanced.phrases).map((key) => `advanced/${key}`),
    );
    for (const name of clips) {
      const r = await fetch(`audio/${name}.mp3`);
      if (!r.ok) return false;
      const b = await c.decodeAudioData(await r.arrayBuffer());
      if (b.duration <= 0) return false;
    }
    await c.close();
    return true;
  });
  expect(decoded).toBe(true);
});

test("320px 無橫向捲動、進度清除需二次確認", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("./");
  await markAll(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "家長：查看進度與設定" }).click();
  await page.getByRole("button", { name: "陪玩設定" }).click();
  await page.getByRole("button", { name: "20 題", exact: true }).click();
  await page.getByRole("button", { name: "清除全部學習紀錄" }).click();
  await expect(page.getByRole("dialog")).toContainText("確定清除全部紀錄");
  await page.getByRole("button", { name: "保留紀錄" }).click();
  await expect(page.locator(".selection-grid .introduced")).toHaveCount(37);
  await page.getByRole("button", { name: "清除全部學習紀錄" }).click();
  await page.getByRole("button", { name: "確定清除", exact: true }).click();
  await expect(page.locator(".selection-grid .introduced")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "5 題", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: /小耳朵，\s*一起去冒險！/ }),
  ).toBeVisible();
});

test("首頁與家長頁的 WCAG AA 自動檢查", async ({ page }) => {
  const { default: AxeBuilder } = await import("@axe-core/playwright");
  await page.goto("./");
  const home = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(home.violations).toEqual([]);
  await parent(page);
  const parentResult = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(parentResult.violations).toEqual([]);
  await page.getByRole("button", { name: "陪玩設定" }).click();
  const settingsResult = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(settingsResult.violations).toEqual([]);
});

test("家長題數設定持久化、三款共用、10 題完整回合及 30 題手機進度", async ({
  page,
}) => {
  await page.goto("./");
  await markAll(page);
  await page.getByRole("button", { name: "家長：查看進度與設定" }).click();
  await page.getByRole("button", { name: "陪玩設定" }).click();
  await page.getByRole("button", { name: "10 題", exact: true }).click();
  await expect(page.getByText(/目前每回合 10 題/)).toBeVisible();
  await page.reload();
  await parent(page);
  await page.getByRole("button", { name: "陪玩設定" }).click();
  await expect(
    page.getByRole("button", { name: "10 題", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "返回", exact: true }).click();
  await page.getByRole("button", { name: "開始玩", exact: true }).click();
  await expect(page.getByText(/作答遊戲一回合 10 題/)).toBeVisible();
  for (const game of ["grid", "command", "match"]) {
    await page.goto(`./#/setup/${game}`);
    await expect(page.getByText(/每回合 10 題，沒有倒數計時/)).toBeVisible();
    await page.getByRole("button", { name: "開始小冒險 →" }).click();
    await expect(page.locator(".round-meta")).toContainText("第 1 / 10 題");
  }
  for (let i = 1; i <= 10; i++) {
    await expect(page.locator(".round-meta")).toContainText(`第 ${i} / 10 題`);
    await ready(page);
    await page.getByRole("button", { name: "這題先略過" }).click();
  }
  await expect(page.getByText("小冒險完成！", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "回遊戲選單" }).click();
  await page.getByRole("button", { name: "家長：查看進度與設定" }).click();
  await expect(page.locator(".summary-card")).toContainText(
    "獨立完成 0 / 10 題",
  );
  await expect(
    page.locator(".metrics > div").nth(1).locator("strong"),
  ).toHaveText("1");
  await page.getByRole("button", { name: "陪玩設定" }).click();
  await page.getByRole("button", { name: "30 題", exact: true }).click();
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("./#/setup/grid");
  await page.getByRole("button", { name: "九格・四方向", exact: true }).click();
  await page.getByRole("button", { name: "開始小冒險 →" }).click();
  await ready(page);
  await expect(page.locator(".round-meta")).toContainText("第 1 / 30 題");
  await expect(page.getByRole("progressbar")).toHaveAttribute("max", "30");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("320×568 九宮格的選項與重聽／提示可直接操作", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("./");
  await markAll(page);
  await page.getByRole("button", { name: /注音九宮格/ }).click();
  await page.getByRole("button", { name: "九格・八方向" }).click();
  await page.getByRole("button", { name: "開始小冒險 →" }).click();
  await ready(page);
  await page.evaluate(() => document.fonts.ready);
  const metrics = await page.locator(".board").boundingBox();
  expect(metrics!.y + metrics!.height).toBeLessThanOrEqual(568);
  for (const name of ["♪ 再聽一次", "小兔幫幫我"]) {
    const b = await page.getByRole("button", { name }).boundingBox();
    expect(b!.y + b!.height).toBeLessThanOrEqual(568);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/${test.info().project.name}-small-grid.png`,
  });
});
