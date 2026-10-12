import { SYMBOLS } from "../data/symbols";
import {
  WORDS,
  TONE_SAMPLES,
  word,
  wordClip,
  toneClip,
  type AdvancedGame,
  type Word,
} from "../data/advanced";
import {
  adjacent,
  AXES,
  ALL_DIRS,
  DIRECTIONS,
  rng,
  shuffle,
  type Direction,
} from "./rules";
export interface AdvancedPool {
  introduced: string[];
  advancedWords: string[];
  introducedTones: number[];
}
export interface AdvancedConfig {
  game: AdvancedGame;
  difficulty: number;
  mode: "guided" | "complete";
  questionCount: number;
}
export interface MemoryCard {
  id: string;
  pair: string;
  kind: "symbol" | "sound" | "picture";
  value: string;
  clip?: string;
}
export interface AdvancedQuestion {
  id: string;
  seed: number;
  game: AdvancedGame;
  difficulty: number;
  mode: "guided" | "complete";
  target: string;
  answers: string[];
  choices: string[];
  words: string[];
  clips: string[];
  parts?: string[];
  missing?: number;
  replacement?: string;
  cards?: MemoryCard[];
  board?: string[];
  start?: number;
  directions?: Direction[];
  positions?: number[];
  stepClips?: string[][];
}
export function eligibleWords(pool: AdvancedPool): Word[] {
  return WORDS.filter(
    (w) =>
      pool.advancedWords.includes(w.id) &&
      w.parts.every((id) => pool.introduced.includes(id)),
  );
}
export function eligibleToneSamples(pool: AdvancedPool, difficulty: number) {
  return TONE_SAMPLES.filter(
    (s) =>
      (difficulty === 3 ? !s.id.startsWith("tang") : s.id.startsWith("tang")) &&
      (difficulty !== 0 || [1, 4].includes(s.tone)) &&
      pool.introducedTones.includes(s.tone) &&
      s.parts.every((id) => pool.introduced.includes(id)),
  );
}
export function spellingCandidates(config: AdvancedConfig, pool: AdvancedPool) {
  return eligibleWords(pool).filter((w) =>
    config.game === "train" && config.difficulty === 0
      ? w.parts.length === 2 && w.tone === 1
      : config.game === "train" && config.difficulty === 1
        ? w.parts.length === 2
        : config.difficulty === 2
          ? w.parts.length === 3
          : w.parts.length >= 2,
  );
}
export function requirements(
  config: AdvancedConfig,
  pool: AdvancedPool,
): string | null {
  const { game, difficulty } = config;
  const words = eligibleWords(pool);
  if (game === "treasure")
    return pool.introduced.length >= 9
      ? null
      : "先認識至少 9 個注音，再一起走九格地圖。";
  if (game === "memory" && difficulty < 3)
    return pool.introduced.length >= difficulty + 2
      ? null
      : `先認識至少 ${difficulty + 2} 個注音，再來配對。`;
  if (game === "tone") {
    const needed =
      difficulty === 0
        ? [1, 4]
        : difficulty === 3
          ? [1, 2, 3, 4, 5]
          : [1, 2, 3, 4];
    const samples = eligibleToneSamples(pool, difficulty);
    return needed.every((t) => samples.some((s) => s.tone === t))
      ? null
      : "先認識小教室使用的注音，並聽完這個難度需要的聲調。";
  }
  if (game === "shop" || game === "memory") {
    const needed =
      game === "memory" ? 4 : difficulty === 0 ? 3 : difficulty === 3 ? 9 : 6;
    return words.length >= needed
      ? null
      : `需要 ${needed} 個已聽過、注音也已認識的詞語；目前有 ${words.length} 個。`;
  }
  const selected = spellingCandidates(config, pool);
  return selected.length && pool.introduced.length >= 3
    ? null
    : "先聽小教室的詞語，並認識其中注音；此難度需有相符的兩格或三格拼音。";
}
export function makeAdvancedQuestion(
  config: AdvancedConfig,
  pool: AdvancedPool,
  seed: number,
  recent: string[] = [],
): AdvancedQuestion {
  const reason = requirements(config, pool);
  if (reason) throw new Error(reason);
  const random = rng(seed);
  const { game, difficulty, mode } = config;
  const q: AdvancedQuestion = {
    id: `${game}-${seed}`,
    seed,
    game,
    difficulty,
    mode,
    target: "",
    answers: [],
    choices: [],
    words: [],
    clips: [],
  };
  function choose<T extends { id: string }>(items: T[]) {
    const fresh = items.filter((w) => !recent.slice(-2).includes(w.id));
    return shuffle(fresh.length ? fresh : items, random)[0];
  }
  const words = eligibleWords(pool);
  if (game === "train" || game === "detective") {
    const candidates = spellingCandidates(config, pool);
    // 按本回合出現次數抽取：全部可用詞語各出一次後才開始下一輪。
    const counts = new Map(candidates.map((w) => [w.id, 0]));
    recent.forEach((id) => {
      if (counts.has(id)) counts.set(id, counts.get(id)! + 1);
    });
    const least = Math.min(...counts.values());
    const balanced = candidates.filter((w) => counts.get(w.id) === least);
    const fresh = balanced.filter((w) => w.id !== recent.at(-1));
    const w = shuffle(fresh.length ? fresh : balanced, random)[0];
    q.target = w.id;
    q.words = [w.id];
    q.parts = w.parts;
    const count = difficulty < 2 ? 4 : 6;
    const distractors = shuffle(
      pool.introduced.filter((id) => !w.parts.includes(id)),
      random,
    );
    if (game === "train") {
      q.answers = [...w.parts];
      q.choices = shuffle(
        [
          ...new Set([
            ...w.parts,
            ...distractors.slice(0, Math.max(0, count - w.parts.length)),
          ]),
        ],
        random,
      );
      if (difficulty === 3) q.answers.push(`tone-${w.tone}`);
      q.clips = ["advanced/train-help", wordClip(w.id)];
    } else {
      q.missing =
        difficulty === 0
          ? w.parts.length - 1
          : Math.floor(random() * w.parts.length);
      q.answers = [w.parts[q.missing]];
      q.choices = shuffle(
        [
          q.answers[0],
          ...shuffle(
            pool.introduced.filter((id) => id !== q.answers[0]),
            random,
          ).slice(0, 2),
        ],
        random,
      );
      if (difficulty === 3)
        q.replacement = shuffle(
          pool.introduced.filter((id) => id !== q.answers[0]),
          random,
        )[0];
      q.clips = [
        difficulty === 3 ? "advanced/repair-help" : "advanced/detective-help",
        wordClip(w.id),
      ];
    }
  } else if (game === "tone") {
    const samples = eligibleToneSamples(pool, difficulty);
    const first = choose(samples);
    const selected =
      difficulty === 2
        ? [
            first,
            shuffle(
              samples.filter((s) => s.id !== first.id),
              random,
            )[0],
          ]
        : [first];
    q.target = selected.map((s) => s.id).join("+");
    q.words = selected.map((s) => s.id);
    q.answers = selected.map((s) => `tone-${s.tone}`);
    q.choices = (
      difficulty === 0
        ? [1, 4]
        : difficulty === 3
          ? [1, 2, 3, 4, 5]
          : [1, 2, 3, 4]
    ).map((t) => `tone-${t}`);
    q.clips = [
      difficulty === 3
        ? "advanced/tone-last"
        : difficulty === 2
          ? "advanced/tone-sequence"
          : "advanced/tone-help",
      ...selected.map((s) => toneClip(s.id)),
    ];
  } else if (game === "shop") {
    const count = difficulty === 0 ? 3 : difficulty === 3 ? 9 : 6;
    const items = shuffle(words, random).slice(0, count);
    const target = choose(items);
    q.words = [
      target.id,
      ...shuffle(
        items.filter((w) => w.id !== target.id),
        random,
      )
        .slice(0, Math.max(0, difficulty - 1))
        .map((w) => w.id),
    ];
    q.target = q.words.join("+");
    q.answers = q.words;
    q.choices = shuffle(
      items.map((w) => w.id),
      random,
    );
    q.clips = ["advanced/shop-help"];
  } else if (game === "memory") {
    const pairs =
      difficulty === 3
        ? shuffle(
            words.map((w) => w.id),
            random,
          ).slice(0, 4)
        : shuffle(pool.introduced, random).slice(0, difficulty + 2);
    q.target = pairs.join("+");
    q.words = difficulty === 3 ? pairs : [];
    q.cards = shuffle(
      pairs.flatMap((pair, i): MemoryCard[] => [
        {
          id: `${i}-visual`,
          pair,
          kind: difficulty === 3 ? "picture" : "symbol",
          value: pair,
          clip: difficulty === 3 ? wordClip(pair) : `symbols/${pair}`,
        },
        {
          id: `${i}-sound`,
          pair,
          kind: "sound",
          value: pair,
          clip: difficulty === 3 ? wordClip(pair) : `symbols/${pair}`,
        },
      ]),
      random,
    );
    q.clips = ["advanced/memory-help"];
  } else {
    q.board = shuffle(pool.introduced, random).slice(0, 9);
    q.start = 4;
    q.positions = [];
    q.directions = [];
    let position = q.start;
    for (let i = 0; i < Math.min(3, difficulty + 1); i++) {
      const legal = (difficulty === 3 ? ALL_DIRS : AXES).filter(
        (d) => adjacent(position, d, 3) !== null,
      );
      const direction = shuffle(legal, random)[0];
      position = adjacent(position, direction, 3)!;
      q.directions.push(direction);
      q.positions.push(position);
    }
    q.target = q.board[q.start];
    q.answers = q.positions.map((i) => `cell-${i}`);
    q.choices = q.board.map((_, i) => `cell-${i}`);
    q.stepClips = q.directions.map((d, i) => [
      i === 0
        ? "advanced/first"
        : i === q.directions!.length - 1
          ? "advanced/last"
          : "advanced/then",
      `advanced/move-${d}`,
    ]);
    q.clips = [
      "advanced/route-start",
      `symbols/${q.target}`,
      "advanced/route-ready",
      ...q.stepClips.flat(),
    ];
  }
  validateAdvancedQuestion(q, pool);
  return q;
}
export function validateAdvancedQuestion(
  q: AdvancedQuestion,
  pool: AdvancedPool,
) {
  if (new Set(q.choices).size !== q.choices.length) throw new Error("重複選項");
  if (q.parts?.some((id) => !pool.introduced.includes(id)))
    throw new Error("未引入符號");
  if (
    q.game === "train" ||
    q.game === "detective" ||
    q.game === "shop" ||
    (q.game === "memory" && q.difficulty === 3)
  ) {
    if (q.words.some((id) => !eligibleWords(pool).some((w) => w.id === id)))
      throw new Error("未教詞語");
  }
  if (q.game === "memory") {
    const pairs = q.cards!.map((c) => c.pair);
    for (const pair of new Set(pairs)) {
      const cards = q.cards!.filter((c) => c.pair === pair);
      if (
        cards.length !== 2 ||
        cards.filter((c) => c.kind === "sound").length !== 1
      )
        throw new Error("不合法配對");
      if (q.difficulty < 3 && !pool.introduced.includes(pair))
        throw new Error("未引入符號");
    }
  } else if (q.game === "treasure") {
    if (
      new Set(q.board).size !== 9 ||
      q.board!.some((id) => !pool.introduced.includes(id))
    )
      throw new Error("不合法地圖");
    let p = q.start!;
    q.directions!.forEach((d, i) => {
      const next = adjacent(p, d, 3);
      if (
        next === null ||
        next !== q.positions![i] ||
        q.answers[i] !== `cell-${next}`
      )
        throw new Error("路線越界");
      p = next;
    });
  } else {
    for (const answer of q.answers)
      if (
        !q.choices.includes(answer) &&
        !(q.game === "train" && answer.startsWith("tone-"))
      )
        throw new Error("答案不在選項");
  }
}
export interface AdvancedAttempt {
  step: number;
  mistakes: number;
  replays: number;
  hints: number;
  interrupted: boolean;
}
export const initialAdvancedAttempt = (): AdvancedAttempt => ({
  step: 0,
  mistakes: 0,
  replays: 0,
  hints: 0,
  interrupted: false,
});
export function advanceAnswer(
  q: AdvancedQuestion,
  state: AdvancedAttempt,
  answer: string,
): AdvancedAttempt {
  if (state.step >= q.answers.length) return state;
  return answer === q.answers[state.step]
    ? { ...state, step: state.step + 1 }
    : { ...state, mistakes: state.mistakes + 1 };
}
export function chooseMemory(
  cards: MemoryCard[],
  matched: string[],
  open: string[],
  id: string,
) {
  const selected = cards.find((c) => c.id === id);
  if (
    !selected ||
    open.length >= 2 ||
    open.includes(id) ||
    matched.includes(selected.pair)
  )
    return { open, matched, outcome: "ignored" as const };
  const next = [...open, id];
  if (next.length < 2) return { open: next, matched, outcome: "open" as const };
  const a = cards.find((c) => c.id === next[0])!;
  return a.pair === selected.pair
    ? {
        open: next,
        matched: [...matched, selected.pair],
        outcome: "match" as const,
      }
    : { open: next, matched, outcome: "miss" as const };
}
export function advancedKind(state: AdvancedAttempt, skipped = false) {
  if (state.interrupted) return "interrupted" as const;
  if (skipped) return "skipped" as const;
  if (state.hints >= 3) return "taught" as const;
  if (state.hints || state.mistakes) return "supported" as const;
  if (state.replays) return "replayed" as const;
  return "independent" as const;
}
export function routeText(q: AdvancedQuestion) {
  return q
    .directions!.map(
      (d, i) =>
        `${i === 0 ? "先" : i === q.directions!.length - 1 ? "最後" : "再"}往${DIRECTIONS[d].label.replace("面", "").replace("邊", "")}走一格`,
    )
    .join("，");
}
export function wordNotation(w: Word) {
  return (
    w.parts.map((id) => SYMBOLS.find((s) => s.id === id)!.glyph).join("") +
    (w.tone === 1 ? "" : w.tone === 2 ? "ˊ" : w.tone === 3 ? "ˇ" : "ˋ")
  );
}
