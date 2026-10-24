import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { WORDS } from "../src/data/advanced";
import { BUILD_ID, VERSION } from "../src/data/symbols";
describe("發行版與題庫一致性", () => {
  it("發布資料與執行中版本一致，且保有 138 個詞語", () => {
    const release = JSON.parse(readFileSync("public/release.json", "utf8"));
    expect(release.version).toBe(VERSION);
    expect(release.build).toBe(BUILD_ID);
    expect(release.words).toBe(WORDS.length);
    expect(release.symbols).toBe(37);
    expect(WORDS.length).toBe(138);
  });
});
