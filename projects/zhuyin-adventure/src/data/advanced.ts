import { SYMBOLS } from "./symbols";
export const ADVANCED_GAMES = {
  train: {
    title: "拼音小火車",
    tag: "聽聲音・組音節",
    icon: "🚂",
    color: "peach",
    help: "聽完整讀音，再依序點注音，放進小火車。",
    levels: ["兩個符號・聽拼音", "兩個符號・四聲", "兩、三個符號混合", "拼音＋選聲調"],
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
    levels: ["補最後一格", "任一格補字", "兩、三符號混合補字", "修好問號框"],
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
  /** emoji illustration for expanded vocabulary; original 18 keep SVG artwork/MP3. */
  emoji?: string;
}
const entries: [string, string, string, number, string?][] = [
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
  // 全部為單音節臺灣常見實詞；增加題庫時不可用亂數拼合注音。
  ...[
    [
      "wolf",
      "狼",
      "ㄌㄤ",
      2,
      "🐺"
    ],
    [
      "snake",
      "蛇",
      "ㄕㄜ",
      2,
      "🐍"
    ],
    [
      "duck",
      "鴨",
      "ㄧㄚ",
      1,
      "🦆"
    ],
    [
      "goose",
      "鵝",
      "ㄜ",
      2,
      "🪿"
    ],
    [
      "bird",
      "鳥",
      "ㄋㄧㄠ",
      3,
      "🐦"
    ],
    [
      "tiger",
      "虎",
      "ㄏㄨ",
      3,
      "🐯"
    ],
    [
      "deer",
      "鹿",
      "ㄌㄨ",
      4,
      "🦌"
    ],
    [
      "sheep",
      "羊",
      "ㄧㄤ",
      2,
      "🐑"
    ],
    [
      "bear",
      "熊",
      "ㄒㄩㄥ",
      2,
      "🐻"
    ],
    [
      "monkey",
      "猴",
      "ㄏㄡ",
      2,
      "🐒"
    ],
    [
      "mouse",
      "鼠",
      "ㄕㄨ",
      3,
      "🐭"
    ],
    [
      "elephant",
      "象",
      "ㄒㄧㄤ",
      4,
      "🐘"
    ],
    [
      "bee",
      "蜂",
      "ㄈㄥ",
      1,
      "🐝"
    ],
    [
      "ant",
      "蟻",
      "ㄧ",
      3,
      "🐜"
    ],
    [
      "frog",
      "蛙",
      "ㄨㄚ",
      1,
      "🐸"
    ],
    [
      "crab",
      "蟹",
      "ㄒㄧㄝ",
      4,
      "🦀"
    ],
    [
      "shrimp",
      "蝦",
      "ㄒㄧㄚ",
      1,
      "🦐"
    ],
    [
      "whale",
      "鯨",
      "ㄐㄧㄥ",
      1,
      "🐋"
    ],
    [
      "lion",
      "獅",
      "ㄕ",
      1,
      "🦁"
    ],
    [
      "leopard",
      "豹",
      "ㄅㄠ",
      4,
      "🐆"
    ],
    [
      "fox",
      "狐",
      "ㄏㄨ",
      2,
      "🦊"
    ],
    [
      "turtle",
      "龜",
      "ㄍㄨㄟ",
      1,
      "🐢"
    ],
    [
      "eagle",
      "鷹",
      "ㄧㄥ",
      1,
      "🦅"
    ],
    [
      "worm",
      "蟲",
      "ㄔㄨㄥ",
      2,
      "🐛"
    ],
    [
      "pear",
      "梨",
      "ㄌㄧ",
      2,
      "🍐"
    ],
    [
      "peach",
      "桃",
      "ㄊㄠ",
      2,
      "🍑"
    ],
    [
      "egg",
      "蛋",
      "ㄉㄢ",
      4,
      "🥚"
    ],
    [
      "candy",
      "糖",
      "ㄊㄤ",
      2,
      "🍬"
    ],
    [
      "cookie",
      "餅",
      "ㄅㄧㄥ",
      3,
      "🍪"
    ],
    [
      "noodle",
      "麵",
      "ㄇㄧㄢ",
      4,
      "🍜"
    ],
    [
      "tea-single",
      "茶",
      "ㄔㄚ",
      2,
      "🍵"
    ],
    [
      "milk",
      "奶",
      "ㄋㄞ",
      3,
      "🥛"
    ],
    [
      "water",
      "水",
      "ㄕㄨㄟ",
      3,
      "💧"
    ],
    [
      "ice",
      "冰",
      "ㄅㄧㄥ",
      1,
      "🧊"
    ],
    [
      "honey",
      "蜜",
      "ㄇㄧ",
      4,
      "🍯"
    ],
    [
      "greens",
      "菜",
      "ㄘㄞ",
      4,
      "🥬"
    ],
    [
      "onion",
      "蔥",
      "ㄘㄨㄥ",
      1,
      "🧅"
    ],
    [
      "garlic",
      "蒜",
      "ㄙㄨㄢ",
      4,
      "🧄"
    ],
    [
      "mushroom",
      "菇",
      "ㄍㄨ",
      1,
      "🍄"
    ],
    [
      "rice",
      "飯",
      "ㄈㄢ",
      4,
      "🍚"
    ],
    [
      "soup",
      "湯",
      "ㄊㄤ",
      1,
      "🍲"
    ],
    [
      "salt",
      "鹽",
      "ㄧㄢ",
      2,
      "🧂"
    ],
    [
      "meat",
      "肉",
      "ㄖㄡ",
      4,
      "🍖"
    ],
    [
      "berry",
      "莓",
      "ㄇㄟ",
      2,
      "🍓"
    ],
    [
      "pepper",
      "椒",
      "ㄐㄧㄠ",
      1,
      "🌶️"
    ],
    [
      "sea",
      "海",
      "ㄏㄞ",
      3,
      "🌊"
    ],
    [
      "cloud",
      "雲",
      "ㄩㄣ",
      2,
      "☁️"
    ],
    [
      "wind",
      "風",
      "ㄈㄥ",
      1,
      "🌬️"
    ],
    [
      "rain",
      "雨",
      "ㄩ",
      3,
      "🌧️"
    ],
    [
      "snow",
      "雪",
      "ㄒㄩㄝ",
      3,
      "❄️"
    ],
    [
      "moon",
      "月",
      "ㄩㄝ",
      4,
      "🌙"
    ],
    [
      "star",
      "星",
      "ㄒㄧㄥ",
      1,
      "⭐"
    ],
    [
      "sun",
      "日",
      "ㄖ",
      4,
      "☀️"
    ],
    [
      "fire",
      "火",
      "ㄏㄨㄛ",
      3,
      "🔥"
    ],
    [
      "stone",
      "石",
      "ㄕ",
      2,
      "🪨"
    ],
    [
      "grass",
      "草",
      "ㄘㄠ",
      3,
      "🌱"
    ],
    [
      "leaf",
      "葉",
      "ㄧㄝ",
      4,
      "🍃"
    ],
    [
      "bamboo",
      "竹",
      "ㄓㄨ",
      2,
      "🎋"
    ],
    [
      "sand",
      "沙",
      "ㄕㄚ",
      1,
      "🏖️"
    ],
    [
      "island",
      "島",
      "ㄉㄠ",
      3,
      "🏝️"
    ],
    [
      "rainbow",
      "虹",
      "ㄏㄨㄥ",
      2,
      "🌈"
    ],
    [
      "thunder",
      "雷",
      "ㄌㄟ",
      2,
      "🌩️"
    ],
    [
      "bubble",
      "泡",
      "ㄆㄠ",
      4,
      "🫧"
    ],
    [
      "river",
      "河",
      "ㄏㄜ",
      2,
      "🏞️"
    ],
    [
      "pine",
      "松",
      "ㄙㄨㄥ",
      1,
      "🌲"
    ],
    [
      "lotus",
      "蓮",
      "ㄌㄧㄢ",
      2,
      "🪷"
    ],
    [
      "fog",
      "霧",
      "ㄨ",
      4,
      "🌫️"
    ],
    [
      "door",
      "門",
      "ㄇㄣ",
      2,
      "🚪"
    ],
    [
      "window",
      "窗",
      "ㄔㄨㄤ",
      1,
      "🪟"
    ],
    [
      "bed",
      "床",
      "ㄔㄨㄤ",
      2,
      "🛏️"
    ],
    [
      "lamp",
      "燈",
      "ㄉㄥ",
      1,
      "💡"
    ],
    [
      "pen",
      "筆",
      "ㄅㄧ",
      3,
      "✏️"
    ],
    [
      "bowl",
      "碗",
      "ㄨㄢ",
      3,
      "🥣"
    ],
    [
      "plate",
      "盤",
      "ㄆㄢ",
      2,
      "🍽️"
    ],
    [
      "fork",
      "叉",
      "ㄔㄚ",
      1,
      "🍴"
    ],
    [
      "knife",
      "刀",
      "ㄉㄠ",
      1,
      "🔪"
    ],
    [
      "pan",
      "鍋",
      "ㄍㄨㄛ",
      1,
      "🍳"
    ],
    [
      "teapot",
      "壺",
      "ㄏㄨ",
      2,
      "🫖"
    ],
    [
      "clock",
      "鐘",
      "ㄓㄨㄥ",
      1,
      "🕰️"
    ],
    [
      "watch",
      "錶",
      "ㄅㄧㄠ",
      3,
      "⌚"
    ],
    [
      "mirror",
      "鏡",
      "ㄐㄧㄥ",
      4,
      "🪞"
    ],
    [
      "comb",
      "梳",
      "ㄕㄨ",
      1,
      "🪮"
    ],
    [
      "shoe",
      "鞋",
      "ㄒㄧㄝ",
      2,
      "👟"
    ],
    [
      "hat-single",
      "帽",
      "ㄇㄠ",
      4,
      "🧢"
    ],
    [
      "sock",
      "襪",
      "ㄨㄚ",
      4,
      "🧦"
    ],
    [
      "umbrella",
      "傘",
      "ㄙㄢ",
      3,
      "☂️"
    ],
    [
      "chair",
      "椅",
      "ㄧ",
      3,
      "🪑"
    ],
    [
      "box",
      "箱",
      "ㄒㄧㄤ",
      1,
      "📦"
    ],
    [
      "lock",
      "鎖",
      "ㄙㄨㄛ",
      3,
      "🔒"
    ],
    [
      "bag",
      "袋",
      "ㄉㄞ",
      4,
      "🛍️"
    ],
    [
      "piano",
      "琴",
      "ㄑㄧㄣ",
      2,
      "🎹"
    ],
    [
      "drum",
      "鼓",
      "ㄍㄨ",
      3,
      "🥁"
    ],
    [
      "bell",
      "鈴",
      "ㄌㄧㄥ",
      2,
      "🔔"
    ],
    [
      "ruler",
      "尺",
      "ㄔ",
      3,
      "📏"
    ],
    [
      "flag",
      "旗",
      "ㄑㄧ",
      2,
      "🚩"
    ],
    [
      "thread",
      "線",
      "ㄒㄧㄢ",
      4,
      "🧵"
    ],
    [
      "needle",
      "針",
      "ㄓㄣ",
      1,
      "🪡"
    ],
    [
      "fan",
      "扇",
      "ㄕㄢ",
      4,
      "🪭"
    ],
    [
      "saw",
      "鋸",
      "ㄐㄩ",
      4,
      "🪚"
    ],
    [
      "net",
      "網",
      "ㄨㄤ",
      3,
      "🥅"
    ],
    [
      "house",
      "屋",
      "ㄨ",
      1,
      "🏠"
    ],
    [
      "bridge",
      "橋",
      "ㄑㄧㄠ",
      2,
      "🌉"
    ],
    [
      "ship",
      "船",
      "ㄔㄨㄢ",
      2,
      "🚢"
    ],
    [
      "wheel",
      "輪",
      "ㄌㄨㄣ",
      2,
      "🛞"
    ],
    [
      "sail",
      "帆",
      "ㄈㄢ",
      1,
      "⛵"
    ],
    [
      "tower",
      "塔",
      "ㄊㄚ",
      3,
      "🗼"
    ],
    [
      "road",
      "路",
      "ㄌㄨ",
      4,
      "🛣️"
    ],
    [
      "ladder",
      "梯",
      "ㄊㄧ",
      1,
      "🪜"
    ],
    [
      "hand",
      "手",
      "ㄕㄡ",
      3,
      "✋"
    ],
    [
      "foot",
      "腳",
      "ㄐㄧㄠ",
      3,
      "🦶"
    ],
    [
      "eye",
      "眼",
      "ㄧㄢ",
      3,
      "👁️"
    ],
    [
      "ear",
      "耳",
      "ㄦ",
      3,
      "👂"
    ],
    [
      "nose",
      "鼻",
      "ㄅㄧ",
      2,
      "👃"
    ],
    [
      "mouth",
      "嘴",
      "ㄗㄨㄟ",
      3,
      "👄"
    ],
    [
      "tooth",
      "牙",
      "ㄧㄚ",
      2,
      "🦷"
    ],
    [
      "heart",
      "心",
      "ㄒㄧㄣ",
      1,
      "❤️"
    ],
    [
      "bone",
      "骨",
      "ㄍㄨ",
      3,
      "🦴"
    ],
    [
      "blood",
      "血",
      "ㄒㄧㄝ",
      3,
      "🩸"
    ],
    [
      "face",
      "臉",
      "ㄌㄧㄢ",
      3,
      "🙂"
    ],
    [
      "hair",
      "髮",
      "ㄈㄚ",
      3,
      "💇"
    ]
  ],
];
export const WORDS: Word[] = entries.map(([id, text, parts, tone, emoji]) => ({
  id,
  text,
  parts: symbolIds(parts),
  tone,
  picture: id,
  emoji,
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
