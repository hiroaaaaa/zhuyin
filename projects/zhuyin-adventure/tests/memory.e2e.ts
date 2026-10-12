import { test, expect, type Page } from "@playwright/test";
import { ADVANCED_GAMES } from "../src/data/advanced";
test.use({ serviceWorkers: "block" });
async function ready(page: Page) {
  await expect(
    page.getByRole("button", { name: "小兔幫幫我", exact: true }),
  ).toBeEnabled();
}
async function setup(page: Page, difficulty: number) {
  // Observe real Web Audio starts, without replacing decoding or playback.
  await page.addInitScript(() => {
    (window as any).audioStarts = 0;
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      if (this.buffer && this.buffer.duration > 0)
        (window as any).audioStarts++;
      return start.apply(this, args);
    };
  });
  await page.goto("./");
  await page.getByRole("button", { name: /家長專區|家長：查看/ }).click();
  const dialog = page.getByRole("dialog");
  if (await dialog.isVisible()) {
    const match = (await dialog.innerText()).match(/(\d+) \+ (\d+)/)!;
    await dialog.getByRole("textbox").fill(String(+match[1] + +match[2]));
    await dialog.getByRole("button", { name: "進入家長專區" }).click();
  }
  await page.getByRole("button", { name: "陪玩設定" }).click();
  await page.getByRole("button", { name: "我已確認：37 個都學過" }).click();
  await page.getByRole("button", { name: "我已確認：18 個詞語都學過" }).click();
  await page.goto("./#/advanced/memory");
  await page
    .getByRole("button", {
      name: ADVANCED_GAMES.memory.levels[difficulty],
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "開始小冒險 →" }).click();
  await ready(page);
}
async function starts(page: Page) {
  return page.evaluate(() => (window as any).audioStarts as number);
}
for (let difficulty = 0; difficulty < 4; difficulty++) {
  test(`翻翻樂 ${difficulty + 1}：每張卡實際播放、配錯可重試、整組配完自動換題`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    await setup(page, difficulty);
    const cards = page.locator(".memory-board button");
    const visual = cards.filter({ hasText: "字圖" });
    const first = visual.nth(0),
      second = visual.nth(1);
    const initial = await starts(page);
    await first.click();
    await ready(page);
    expect(await starts(page)).toBe(initial + 1);
    await expect(
      page.getByRole("button", { name: "♪ 重聽這張卡", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "♪ 重聽這張卡", exact: true })
      .click();
    await ready(page);
    expect(await starts(page)).toBe(initial + 2);
    await second.click();
    await expect(
      page.getByRole("button", { name: "再找找", exact: true }),
    ).toBeVisible();
    expect(await starts(page)).toBe(initial + 3); // Read the card; no nagging retry voice.
    await expect(page.locator(".memory-meta")).toContainText("已找到 0");
    await expect(page.locator(".advanced-instruction")).toContainText(
      "還不是一對",
    );
    await page.getByRole("button", { name: "再找找", exact: true }).click();
    for (let i = 0; i < 2; i++) {
      await ready(page);
      await page
        .getByRole("button", { name: "小兔幫幫我", exact: true })
        .click();
    }
    await ready(page);
    const labels = await cards.evaluateAll((buttons) =>
      buttons.map((b) => b.getAttribute("aria-label")!),
    );
    const pairs = new Map<string, string[]>();
    for (const label of labels) {
      const key = label.split("，").at(-1)!;
      pairs.set(key, [...(pairs.get(key) || []), label]);
    }
    for (const pair of pairs.values()) {
      expect(pair).toHaveLength(2);
      for (let i = 0; i < 2; i++) {
        await ready(page);
        const before = await starts(page);
        await page.getByRole("button", { name: pair[i], exact: true }).click();
        await expect
          .poll(() => starts(page))
          .toBeGreaterThanOrEqual(before + 1);
        if (i === 0) {
          await ready(page);
          expect(await starts(page)).toBe(before + 1);
        }
      }
    }
    await expect(page.locator(".round-meta")).toContainText("第 2 / 5 題", {
      timeout: 30000,
    });
    await page.screenshot({
      path: `test-results/${test.info().project.name}-memory-fixed.png`,
    });
  });
}
test("翻翻樂音檔失敗：不判錯，重新啟用後重播原卡而非玩法說明", async ({
  page,
}) => {
  await setup(page, 0);
  await page.route("**/audio/symbols/*.mp3", (route) => route.abort());
  const cards = page.locator(".memory-board button");
  await cards.filter({ hasText: "字圖" }).first().click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.locator(".memory-meta")).toContainText("已找到 0");
  await expect(
    page.getByRole("button", { name: "再找找", exact: true }),
  ).toHaveCount(0);
  const before = await starts(page);
  await page.unroute("**/audio/symbols/*.mp3");
  const requested = page.waitForResponse(
    (r) => /\/audio\/symbols\/s\d+\.mp3$/.test(r.url()) && r.ok(),
  );
  await page.getByRole("button", { name: "重新啟用聲音", exact: true }).click();
  await requested;
  await ready(page);
  expect(await starts(page)).toBe(before + 1);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(cards.filter({ has: page.locator(".glyph") })).toHaveCount(1);
});
