import { test, expect } from "@playwright/test";
test.describe.configure({ mode: "parallel" });
test.use({ serviceWorkers: "block" });
test("音效：iOS 播放類別、實際語音及重新啟用", async ({ page }) => {
  await page.addInitScript(() => {
    if (!("audioSession" in navigator))
      Object.defineProperty(navigator, "audioSession", {
        value: { type: "auto" },
        configurable: true,
      });
  });
  await page.goto("./");
  await page.getByRole("button", { name: "♪ 聽小兔說話", exact: true }).click();
  await expect(page.getByTestId("audio-result")).toContainText("播放已結束");
  expect(await page.evaluate(() => (navigator as any).audioSession.type)).toBe(
    "playback",
  );
  await page.getByRole("button", { name: "重新啟用聲音", exact: true }).click();
  await expect(page.getByTestId("audio-result")).toContainText("播放已結束");
  await expect(
    page.getByRole("button", { name: "♪ 聽小兔說話", exact: true }),
  ).toBeEnabled();
});
test("音效：音檔失敗顯示提示，重試恢復播放", async ({ page }) => {
  await page.route("**/audio/voice/welcome.mp3", (route) => route.abort());
  await page.goto("./");
  await page.getByRole("button", { name: "♪ 聽小兔說話", exact: true }).click();
  await expect(page.getByTestId("audio-result")).toHaveAttribute(
    "role",
    "alert",
  );
  await page.unroute("**/audio/voice/welcome.mp3");
  await page.getByRole("button", { name: "重新啟用聲音", exact: true }).click();
  await expect(page.getByTestId("audio-result")).toContainText("播放已結束");
});
