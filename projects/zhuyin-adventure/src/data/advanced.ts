import { SYMBOLS } from "./symbols";
export const ADVANCED_GAMES = {
  train: {
    title: "拼音小火車",
    tag: "聽聲音・組音節",
    icon: "🚂",
    color: "peach",
    help: "聽完整讀音，再依序點注音，放進小火車。",
    levels: ["兩個符號・聽拼音", "兩個符號・四聲", "三個符號", "拼音＋選聲調"],
  },
  tone: {
    title: "聲調氣球",
    tag: "聽高低・找聲調",
    icon: "🎈",
    color: "blue",
    help: "聽清楚聲音，點出相同聲調的氣球。",
    levels: ["一聲與四聲", "四種聲調", "兩個聲音依序選", "詞語末音・含輕聲"],
  },
  detective: {
    title: "缺字小偵探",
    tag: "補一補・找錯字",
    icon: "🔎",
    color: "yellow",
    help: "聽完整讀音，找出問號那一格應該放的注音。",
    levels: ["補最後一格", "任一格補字", "三個符號補字", "修好問號框"],
  },
  shop: {
    title: "注音小商店",
    tag: "讀訂單・找圖片",
    icon: "🛒",
    color: "green",
    help: "看注音訂單，照順序點圖片，放進小籃子。",
    levels: [
      "三張圖・一樣商品",
      "六張圖・一樣商品",
      "六張圖・兩樣商品",
      "九張圖・三樣商品",
    ],
  },
  memory: {
    title: "聲音翻翻樂",
    tag: "翻字卡・配聲音",
    icon: "🃏",
    color: "peach",
    help: "找一張字圖和一張聲音卡，讀音相同就是一對。每張翻開都會念給你聽。",
    levels: [
      "四張・符號配聲音",
      "六張・符號配聲音",
      "八張・符號配聲音",
      "八張・圖片配詞音",
    ],
  },
  treasure: {
    title: "注音尋寶地圖",
    tag: "走一格・記路線",
    icon: "🗺️",
    color: "yellow",
    help: "先找小兔的位置，聽方向，點下一格帶小兔尋寶。",
    levels: [
      "走一步・四方向",
      "走兩步・四方向",
      "走三步・四方向",
      "走三步・八方向",
    ],
  },
} as const;
export type AdvancedGame = keyof typeof ADVANCED_GAMES;
export const isAdvancedGame = (value: string): value is AdvancedGame =>
  Object.hasOwn(ADVANCED_GAMES, value);
export const TONES = [
  { id: 1, mark: "", label: "一聲（不標）", path: "M10 23H90" },
  { id: 2, mark: "ˊ", label: "二聲", path: "M10 58L90 15" },
  { id: 3, mark: "ˇ", label: "三聲", path: "M10 23L45 65L90 24" },
  { id: 4, mark: "ˋ", label: "四聲", path: "M10 15L90 65" },
  { id: 5, mark: "˙", label: "輕聲", path: "M43 42H57" },
] as const;
export function symbolIds(parts: string) {
  return Array.from(parts).map((g) => {
    const s = SYMBOLS.find((s) => s.glyph === g);
    if (!s) throw new Error(`未知符號 ${g}`);
    return s.id;
  });
}
export interface Word {
  id: string;
  text: string;
  parts: string[];
  tone: number;
  picture: string;
}
const entries: [string, string, string, number][] = [
  ["cat", "貓", "ㄇㄠ", 1],
  ["chicken", "雞", "ㄐㄧ", 1],
  ["melon", "瓜", "ㄍㄨㄚ", 1],
  ["flower", "花", "ㄏㄨㄚ", 1],
  ["fish", "魚", "ㄩ", 2],
  ["cow", "牛", "ㄋㄧㄡ", 2],
  ["ball", "球", "ㄑㄧㄡ", 2],
  ["horse", "馬", "ㄇㄚ", 3],
  ["dog", "狗", "ㄍㄡ", 3],
  ["rabbit", "兔", "ㄊㄨ", 4],
  ["tree", "樹", "ㄕㄨ", 4],
  ["bean", "豆", "ㄉㄡ", 4],
  ["book", "書", "ㄕㄨ", 1],
  ["pig", "豬", "ㄓㄨ", 1],
  ["car", "車", "ㄔㄜ", 1],
  ["bun", "包", "ㄅㄠ", 1],
  ["cup", "杯", "ㄅㄟ", 1],
  ["mountain", "山", "ㄕㄢ", 1],
];
export const WORDS: Word[] = entries.map(([id, text, parts, tone]) => ({
  id,
  text,
  parts: symbolIds(parts),
  tone,
  picture: id,
}));
export const word = (id: string) => WORDS.find((w) => w.id === id)!;
export interface ToneSample {
  id: string;
  text: string;
  parts: string[];
  tone: number;
}
export const TONE_SAMPLES: ToneSample[] = [
  { id: "tang1", text: "湯", parts: symbolIds("ㄊㄤ"), tone: 1 },
  { id: "tang2", text: "糖", parts: symbolIds("ㄊㄤ"), tone: 2 },
  { id: "tang3", text: "躺", parts: symbolIds("ㄊㄤ"), tone: 3 },
  { id: "tang4", text: "燙", parts: symbolIds("ㄊㄤ"), tone: 4 },
  { id: "banana", text: "香蕉", parts: symbolIds("ㄒㄧㄤㄐㄧㄠ"), tone: 1 },
  { id: "tea", text: "紅茶", parts: symbolIds("ㄏㄨㄥㄔㄚ"), tone: 2 },
  { id: "puppy", text: "小狗", parts: symbolIds("ㄒㄧㄠㄍㄡ"), tone: 3 },
  { id: "white-rabbit", text: "白兔", parts: symbolIds("ㄅㄞㄊㄨ"), tone: 4 },
  { id: "hat", text: "帽子", parts: symbolIds("ㄇㄠㄗ"), tone: 5 },
  // 共用已備妥的單字語音，讓聲調練習有更多不同聲音。
  ...WORDS.map((w) => ({ id: `word-${w.id}`, text: w.text, parts: w.parts, tone: w.tone })),
];
export const toneSample = (id: string) =>
  TONE_SAMPLES.find((s) => s.id === id)!;
export const tone = (id: number) => TONES.find((t) => t.id === id)!;
export const wordClip = (id: string) => `advanced/word-${id}`;
export const toneClip = (id: string) =>
  id.startsWith("word-") ? wordClip(id.slice(5)) : `advanced/tone-${id}`;
