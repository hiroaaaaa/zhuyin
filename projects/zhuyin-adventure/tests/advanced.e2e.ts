import { test, expect, type Page } from "@playwright/test";
import { ADVANCED_GAMES, WORDS, type AdvancedGame } from "../src/data/advanced";
test.describe.configure({ mode: "parallel" });
async function canContinue(page: Page) {
  return page
    .locator(".game-controls button")
    .evaluateAll((buttons) =>
      buttons.some(
        (b) =>
          !(b as HTMLButtonElement).disabled &&
          /小兔幫幫我/.test(b.textContent || ""),
      ),
    );
}

async function openParent(page: Page) {
  await page.getByRole("button", { name: /家長專區|家長：查看/ }).click();
  await expect
    .poll(
      async () =>
        (await page.getByRole("dialog").isVisible()) ||
        (await page
          .getByRole("heading", { name: "家長專區", exact: true })
          .isVisible()),
    )
    .toBe(true);
  if (!(await page.getByRole("dialog").isVisible())) return;
  const dialog = page.getByRole("dialog"),
    match = (await dialog.innerText()).match(/(\d+) \+ (\d+)/);
  if (match) {
    await dialog
      .getByRole("textbox")
      .fill(String(Number(match[1]) + Number(match[2])));
    await dialog.getByRole("button", { name: "進入家長專區" }).click();
  }
}
async function teachAll(page: Page) {
  await page.goto("./");
  await openParent(page);
  await page.getByRole("button", { name: "陪玩設定" }).click();
  await page.getByRole("button", { name: "我已確認：37 個都學過" }).click();
  await page.getByRole("button", { name: "我已確認：18 個詞語都學過" }).click();
  await page
    .getByRole("button", { name: "我已確認：四聲與輕聲都學過" })
    .click();
}
async function ready(page: Page) {
  await expect(
    page.getByRole("button", { name: "小兔幫幫我", exact: true }),
  ).toBeEnabled({ timeout: 30000 });
}
async function help(page: Page) {
  for (let i = 0; i < 2; i++) {
    await ready(page);
    await page.getByRole("button", { name: "小兔幫幫我", exact: true }).click();
  }
  await ready(page);
}
for (const original of [true, false]) {
  test(`自動換題：${original ? "聽音找注音" : "聲調氣球"} 完成後暫停不跳題，繼續只推進一次`, async ({
    page,
  }) => {
    await teachAll(page);
    await page.goto(original ? "./#/menu" : "./#/advanced/tone");
    if (original)
      await page.getByRole("button", { name: /聽音找注音/ }).click();
    await page.getByRole("button", { name: "開始小冒險 →" }).click();
    await help(page);
    await page
      .locator(original ? ".board button.hinted" : ".tone-board button.hinted")
      .click();
    await page.waitForFunction(
      () => document.querySelector(".auto-next") !== null,
      undefined,
      { timeout: 30000 },
    );
    await page.getByRole("button", { name: "暫停", exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText("這題已完成");
    await page.waitForTimeout(1000);
    await expect(page.locator(".round-meta")).toContainText("第 1 / 5 題");
    await page
      .getByRole("button", {
        name: original ? "繼續遊戲" : "繼續這一題",
        exact: true,
      })
      .click();
    await expect(page.locator(".round-meta")).toContainText("第 2 / 5 題");
    await ready(page);
    await expect(page.locator(".round-meta")).toContainText("第 2 / 5 題");
    await expect(
      page.getByRole("button", { name: /下一題|領小花貼紙/ }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "返回", exact: true }).click();
    await page.getByRole("button", { name: "回遊戲選單", exact: true }).click();
    await openParent(page);
    if (original)
      await expect(page.locator(".summary-card")).toContainText(
        "獨立完成 0 / 1 題",
      );
    else
      await expect(
        page.locator(".advanced-stats > div").filter({ hasText: "聲調氣球" }),
      ).toContainText("獨立 0 / 1 題");
  });
}
async function answerHinted(page: Page) {
  const before = await page.locator(".round-meta").innerText();
  for (let i = 0; i < 5; i++) {
    if (
      (await page.locator(".round-meta").innerText()) !== before ||
      (await page.locator(".auto-next").isVisible())
    )
      break;
    await ready(page);
    await page.locator(".advanced-play button.hinted").click();
    await expect
      .poll(
        async () =>
          (await page.locator(".auto-next").isVisible()) ||
          (await page.locator(".round-meta").innerText()) !== before ||
          (await canContinue(page)),
        { timeout: 30000 },
      )
      .toBe(true);
  }
  await expect(page.locator(".round-meta")).not.toHaveText(before, {
    timeout: 30000,
  });
}
async function solveWithHelp(page: Page, game: AdvancedGame) {
  await help(page);
  if (game === "memory") {
    const names = await page
      .locator(".memory-board button")
      .evaluateAll((buttons) =>
        buttons.map((b) => b.getAttribute("aria-label")!),
      );
    const pairs = new Map<string, string[]>();
    for (const name of names) {
      const pair = name.split("，").at(-1)!;
      pairs.set(pair, [...(pairs.get(pair) || []), name]);
    }
    for (const cards of pairs.values()) {
      expect(cards).toHaveLength(2);
      for (const name of cards) {
        await ready(page);
        await page.getByRole("button", { name, exact: true }).click();
      }
    }
  } else await answerHinted(page);
  await expect(page.locator(".round-meta")).toContainText("第 2 / 5 題", {
    timeout: 30000,
  });
}

test("拼音入門：題庫不足明確提示，學完新增詞語後五題都不同", async ({
  page,
}) => {
  await teachAll(page);
  for (const label of ["書", "豬", "車", "包", "杯", "山"]) {
    await page
      .locator(".parent-word-options button")
      .filter({ hasText: label })
      .click();
  }
  await page.goto("./#/advanced/train");
  await expect(page.getByRole("status")).toContainText("目前可出 2 個詞語");
  await expect(page.getByRole("status")).toContainText("輪流複習");
  await teachAll(page);
  await page.goto("./#/advanced/train");
  await expect(page.getByRole("status")).toContainText("目前可出 8 個詞語");
  for (const label of ["書", "豬", "車", "包", "杯", "山"]) {
    const art = page
      .getByRole("button", {
        name: `聽${label}的完整讀音，已聽過`,
        exact: true,
      })
      .locator("svg");
    expect(await art.locator("g > *").count()).toBeGreaterThan(0);
  }
  await page.getByRole("button", { name: "開始小冒險 →" }).click();
  const words: string[] = [];
  for (let n = 0; n < 5; n++) {
    await ready(page);
    words.push(
      (await page
        .locator(".train-scene .word-art")
        .getAttribute("aria-label"))!,
    );
    const item = WORDS.find((w) => `${w.text}的圖片` === words.at(-1))!;
    for (const id of item.parts) {
      await ready(page);
      await page
        .locator(`.advanced-choice-grid button:has(img[src$="/${id}.svg"])`)
        .click();
    }
    if (n < 4)
      await expect(page.locator(".round-meta")).toContainText(
        `第 ${n + 2} / 5 題`,
      );
    else
      await expect(
        page.getByRole("heading", { name: "小冒險完成！", exact: true }),
      ).toBeVisible();
  }
  expect(new Set(words).size).toBe(5);
  await expect(page.locator(".result-list")).toContainText("獨立完成");
  await expect(
    page.getByRole("button", { name: /下一題|領小花貼紙/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "小冒險完成！", exact: true }),
  ).toBeVisible();
});
for (const game of Object.keys(ADVANCED_GAMES) as AdvancedGame[]) {
  test(`進階 ${ADVANCED_GAMES[game].title}：最高難度真實作答、完整回合與紀錄`, async ({
    page,
  }) => {
    test.setTimeout(game === "treasure" ? 180000 : 120000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await teachAll(page);
    await page.goto(`./#/advanced/${game}`);
    await page
      .getByRole("button", {
        name: ADVANCED_GAMES[game].levels[3],
        exact: true,
      })
      .click();
    if (game === "treasure")
      await page.getByRole("button", { name: "一次聽完，再出發" }).click();
    await page.getByRole("button", { name: "開始小冒險 →" }).click();
    await ready(page);
    if (game !== "memory") {
      await help(page);
      const wrong = page
        .locator(
          game === "train"
            ? ".advanced-choice-grid button:not(.hinted)"
            : game === "tone"
              ? ".tone-board button:not(.hinted)"
              : game === "shop"
                ? ".shop-shelf button:not(.hinted)"
                : game === "detective"
                  ? ".advanced-choice-grid button:not(.hinted)"
                  : ".treasure-map button:not(.hinted)",
        )
        .first();
      await wrong.click();
      await ready(page);
      // 提示仍會標示目前步驟，錯答不能提前出現完成按鈕。
      await expect(page.getByRole("button", { name: "下一題 →" })).toHaveCount(
        0,
      );
      await answerHinted(page);
    } else await solveWithHelp(page, game);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/${test.info().project.name}-${game}.png`,
    });
    for (let i = 2; i <= 5; i++) {
      await ready(page);
      await expect(page.locator(".round-meta")).toContainText(`第 ${i} / 5 題`);
      await page
        .getByRole("button", { name: "這題先略過", exact: true })
        .click();
    }
    await expect(
      page.getByRole("heading", { name: "小冒險完成！", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "回遊戲選單" }).click();
    await page.getByRole("button", { name: "家長：查看進度與設定" }).click();
    await expect(
      page.locator(".metrics > div").nth(1).locator("strong"),
    ).toHaveText("1");
    const row = page
      .locator(".advanced-stats > div")
      .filter({ hasText: ADVANCED_GAMES[game].title });
    await expect(row).toContainText("獨立 0 / 5 題");
    await page.reload();
    await openParent(page);
    await expect(
      page.locator(".metrics > div").nth(1).locator("strong"),
    ).toHaveText("1");
    expect(errors).toEqual([]);
  });
}
test("進階教學、題庫門檻與 320px 各遊戲主要操作", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("./#/advanced/train");
  await expect(page.getByRole("button", { name: "開始小冒險 →" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "聽貓的完整讀音", exact: true }),
  ).toBeDisabled();
  await teachAll(page);
  for (const game of Object.keys(ADVANCED_GAMES) as AdvancedGame[]) {
    await page.goto(`./#/advanced/${game}`);
    await page
      .getByRole("button", {
        name: ADVANCED_GAMES[game].levels[3],
        exact: true,
      })
      .click();
    await page.getByRole("button", { name: "開始小冒險 →" }).click();
    await ready(page);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    for (const name of ["♪ 再聽一次", "小兔幫幫我"]) {
      const b = await page
        .getByRole("button", { name, exact: true })
        .boundingBox();
      expect(b).not.toBeNull();
      expect(b!.width).toBeGreaterThanOrEqual(56);
    }
  }
});
test("小教室實際聽完才引入詞語及聲調，重新開啟仍保留", async ({ page }) => {
  await page.goto("./");
  await openParent(page);
  await page.getByRole("button", { name: "陪玩設定" }).click();
  await page.getByRole("button", { name: "我已確認：37 個都學過" }).click();
  await page.goto("./#/advanced/train");
  await page
    .getByRole("button", { name: "聽貓的完整讀音", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "聽貓的完整讀音，已聽過", exact: true }),
  ).toBeEnabled();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "聽貓的完整讀音，已聽過", exact: true }),
  ).toBeEnabled();
  await page.goto("./#/advanced/tone");
  await page
    .getByRole("button", { name: "聽一聲（不標）範例", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "聽一聲（不標）範例，已聽過",
      exact: true,
    }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "聽四聲範例", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "開始小冒險 →" }),
  ).toBeEnabled();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "開始小冒險 →" }),
  ).toBeEnabled();
});
test("進階暫停重做、10 題設定與小商店提示不灌獨立分數", async ({ page }) => {
  await teachAll(page);
  await page.getByRole("button", { name: "10 題", exact: true }).click();
  await page.goto("./#/advanced/shop");
  await page
    .getByRole("button", { name: "六張圖・兩樣商品", exact: true })
    .click();
  await page.getByRole("button", { name: "開始小冒險 →" }).click();
  await ready(page);
  await expect(page.locator(".round-meta")).toContainText("第 1 / 10 題");
  await help(page);
  await page.locator(".advanced-play button.hinted").click();
  await ready(page);
  await expect(page.locator(".order-line.packed")).toHaveCount(1);
  await page.getByRole("button", { name: "暫停", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("從這一題重新開始");
  await page.getByRole("button", { name: "繼續這一題", exact: true }).click();
  await ready(page);
  await expect(page.locator(".order-line.packed")).toHaveCount(0);
  for (let i = 0; i < 2; i++) {
    await ready(page);
    await page.locator(".advanced-play button.hinted").click();
  }
  await expect(page.locator(".round-meta")).toContainText("第 2 / 10 題");
  await page.getByRole("button", { name: "返回", exact: true }).click();
  await page.getByRole("button", { name: "回遊戲選單", exact: true }).click();
  await page.getByRole("button", { name: "家長：查看進度與設定" }).click();
  await expect(
    page.locator(".advanced-stats > div").filter({ hasText: "注音小商店" }),
  ).toContainText("尚無有效作答");
});
test("進階畫面 WCAG AA 檢查", async ({ page }) => {
  const { default: AxeBuilder } = await import("@axe-core/playwright");
  await teachAll(page);
  for (const game of [
    "train",
    "tone",
    "detective",
    "shop",
    "memory",
    "treasure",
  ] as AdvancedGame[]) {
    await page.goto(`./#/advanced/${game}`);
    await page.getByRole("button", { name: "開始小冒險 →" }).click();
    await ready(page);
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(result.violations).toEqual([]);
  }
});
