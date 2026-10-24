export interface SymbolInfo {
  id: string;
  glyph: string;
  category: "聲母" | "韻母" | "介音組";
  batch: number;
}
const batches = [
  "ㄅㄆㄇㄈ",
  "ㄧㄨㄩㄚㄛ",
  "ㄉㄊㄋㄌ",
  "ㄍㄎㄏㄜㄝ",
  "ㄐㄑㄒㄦ",
  "ㄓㄔㄕㄖ",
  "ㄗㄘㄙㄞ",
  "ㄟㄠㄡㄢ",
  "ㄣㄤㄥ",
];
export const SYMBOLS: SymbolInfo[] = Array.from({ length: 37 }, (_, i) => ({
  id: `s${String(i + 1).padStart(2, "0")}`,
  glyph: String.fromCharCode(0x3105 + i),
  category: i < 21 ? "聲母" : i < 34 ? "韻母" : "介音組",
  batch:
    batches.findIndex((b) => b.includes(String.fromCharCode(0x3105 + i))) + 1,
}));
export const symbol = (id: string) => SYMBOLS.find((s) => s.id === id)!;
export const batchSymbols = (batch: number) =>
  SYMBOLS.filter((s) => s.batch === batch).map((s) => s.id);
export const VERSION = "1.3.1";
export const BUILD_ID = "20261024-2";
export const CONTENT_VERSION = "moe-2017-v1";
