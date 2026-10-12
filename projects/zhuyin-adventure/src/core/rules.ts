import { SYMBOLS, symbol } from "../data/symbols";
export type Game = "explore" | "match" | "grid" | "command";
export type Direction =
  | "up"
  | "down"
  | "left"
  | "right"
  | "ul"
  | "ur"
  | "dl"
  | "dr";
export const DIRECTIONS: Record<
  Direction,
  { label: string; delta: [number, number]; arrow: string }
> = {
  up: { label: "上面", delta: [-1, 0], arrow: "↑" },
  down: { label: "下面", delta: [1, 0], arrow: "↓" },
  left: { label: "左邊", delta: [0, -1], arrow: "←" },
  right: { label: "右邊", delta: [0, 1], arrow: "→" },
  ul: { label: "左上方", delta: [-1, -1], arrow: "↖" },
  ur: { label: "右上方", delta: [-1, 1], arrow: "↗" },
  dl: { label: "左下方", delta: [1, -1], arrow: "↙" },
  dr: { label: "右下方", delta: [1, 1], arrow: "↘" },
};
export const AXES: Direction[] = ["up", "down", "left", "right"];
export const ALL_DIRS: Direction[] = [...AXES, "ul", "ur", "dl", "dr"];
export interface Step {
  target: number;
  ref?: number;
  direction?: Direction;
  absolute?: number;
}
export interface Question {
  id: string;
  seed: number;
  game: Game;
  board: string[];
  cols: number;
  steps: Step[];
  text: string;
  clips: string[];
  stepClips: string[][];
  difficulty: number;
  mode: "guided" | "complete";
  target: string;
}
export function rng(seed: number) {
  let n = seed >>> 0;
  return () => {
    n += 0x6d2b79f5;
    let t = n;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function shuffle<T>(a: T[], random: () => number) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}
export function adjacent(
  index: number,
  dir: Direction,
  cols: number,
  rows = cols,
) {
  const [r, c] = [Math.floor(index / cols), index % cols];
  const [dy, dx] = DIRECTIONS[dir].delta;
  const nr = r + dy,
    nc = c + dx;
  return nr >= 0 && nr < rows && nc >= 0 && nc < cols ? nr * cols + nc : null;
}
const ABS_LABELS = [
  "最左上角",
  "上面這一排的中間",
  "最右上角",
  "中間這一排的最左邊",
  "正中間",
  "中間這一排的最右邊",
  "最左下角",
  "下面這一排的中間",
  "最右下角",
];
const sclip = (id: string) => `symbols/${id}`;
const vclip = (id: string) => `voice/${id}`;
export function stepAudio(
  step: Step,
  board: string[],
  prefix = "please",
): string[] {
  if (step.absolute !== undefined)
    return [vclip(prefix), vclip(`abs-${step.absolute}`)];
  if (step.ref !== undefined && step.direction)
    return [
      vclip(prefix),
      sclip(board[step.ref]),
      vclip(`dir-${step.direction}`),
    ];
  return [vclip(prefix), sclip(board[step.target])];
}
export function stepText(step: Step, board: string[]): string {
  if (step.absolute !== undefined)
    return `點${ABS_LABELS[step.absolute]}的注音`;
  if (step.ref !== undefined && step.direction)
    return `點${symbol(board[step.ref]).glyph}${DIRECTIONS[step.direction].label}一格的注音`;
  return `點${symbol(board[step.target]).glyph}`;
}
export function makeQuestion(
  game: Game,
  pool: string[],
  difficulty: number,
  seed: number,
  mode: "guided" | "complete" = "guided",
  stepsCount = 2,
  wantedDirection?: Direction,
  preferredTarget?: string,
): Question {
  const unique = [...new Set(pool)].filter((id) =>
    SYMBOLS.some((s) => s.id === id),
  );
  const min = game === "match" || game === "explore" ? 3 : 4;
  if (unique.length < min)
    throw new Error("已引入的注音不足，請先認識更多注音。");
  const random = rng(seed);
  let board: string[], cols: number, steps: Step[];
  if (game === "match" || game === "explore") {
    const sizes = [3, 4, 6, 9];
    const desired = game === "explore" ? 3 : sizes[Math.min(difficulty, 3)];
    const size = [9, 6, 4, 3].find((n) => n <= desired && n <= unique.length)!;
    const target =
      preferredTarget && unique.includes(preferredTarget)
        ? preferredTarget
        : unique[Math.floor(random() * unique.length)];
    board = shuffle(
      [
        target,
        ...shuffle(
          unique.filter((s) => s !== target),
          random,
        ).slice(0, size - 1),
      ],
      random,
    );
    cols = size === 4 ? 2 : 3;
    steps = [{ target: board.indexOf(target) }];
  } else {
    cols = unique.length >= 9 && difficulty > 0 ? 3 : 2;
    board = shuffle(unique, random).slice(0, cols * cols);
    const dirs = cols === 3 && difficulty >= 2 ? ALL_DIRS : AXES;
    const direction =
      wantedDirection && dirs.includes(wantedDirection)
        ? wantedDirection
        : dirs[Math.floor(random() * dirs.length)];
    if (game === "grid") {
      if (difficulty >= 3 && cols === 3) {
        const i = Math.floor(random() * 9);
        steps = [{ target: i, absolute: i }];
      } else {
        const refs = board
          .map((_, i) => i)
          .filter((i) => adjacent(i, direction, cols) !== null);
        const ref = refs[Math.floor(random() * refs.length)];
        steps = [{ ref, direction, target: adjacent(ref, direction, cols)! }];
      }
    } else {
      const count = Math.max(1, Math.min(3, stepsCount));
      const targets = shuffle(
        board.map((_, i) => i),
        random,
      ).slice(0, count);
      steps = targets.map((target) => ({ target }));
      if (difficulty >= 1) {
        const last = count - 1;
        const t = targets[last];
        const candidates = dirs.flatMap((direction) =>
          board
            .map((_, ref) => ({ ref, direction, target: t }))
            .filter((s) => adjacent(s.ref, s.direction, cols) === t),
        );
        steps[last] = candidates[Math.floor(random() * candidates.length)];
      }
    }
  }
  const stepClips = steps.map((s, i) =>
    stepAudio(
      s,
      board,
      game === "command"
        ? i === 0
          ? "first"
          : i === steps.length - 1
            ? "last"
            : "then"
        : "please",
    ),
  );
  const text =
    game === "match"
      ? "聽一聽，點你聽到的注音"
      : game === "explore"
        ? "找到一樣的注音"
        : steps
            .map(
              (s, i) =>
                `${game === "command" ? (i === 0 ? "先" : i === steps.length - 1 ? "最後" : "再") : "請"}${stepText(s, board)}`,
            )
            .join("，");
  const clips =
    game === "match"
      ? [sclip(board[steps[0].target])]
      : game === "explore"
        ? [vclip("look-same")]
        : stepClips.flat();
  const effectiveDifficulty =
    game === "match" ? [3, 4, 6, 9].indexOf(board.length) : difficulty;
  const q = {
    id: `${game}-${seed}`,
    seed,
    game,
    board,
    cols,
    steps,
    text,
    clips,
    stepClips,
    difficulty: effectiveDifficulty,
    mode,
    target: board[steps[0].target],
  };
  validateQuestion(q);
  return q;
}
export function validateQuestion(q: Question) {
  if (new Set(q.board).size !== q.board.length) throw new Error("盤面重複");
  if (!q.board.every((id) => SYMBOLS.some((s) => s.id === id)))
    throw new Error("未知注音");
  const seen = new Set<number>();
  for (const step of q.steps) {
    if (
      step.target < 0 ||
      step.target >= q.board.length ||
      seen.has(step.target)
    )
      throw new Error("目標錯誤或重複");
    seen.add(step.target);
    if (
      step.direction &&
      step.ref !== undefined &&
      adjacent(step.ref, step.direction, q.cols) !== step.target
    )
      throw new Error("方向答案不一致");
    if (
      step.absolute !== undefined &&
      (q.cols !== 3 || step.absolute !== step.target)
    )
      throw new Error("絕對位置不一致");
  }
}
export type Phase =
  | "loading"
  | "listening"
  | "answering"
  | "feedback"
  | "completed"
  | "paused"
  | "error";
export interface RunState {
  phase: Phase;
  step: number;
  mistakes: number;
  replays: number;
  hint: number;
  interrupted: boolean;
  choices: number[];
  feedback: number | null;
  reason: "correct" | "retry" | null;
  lastEvent: string | null;
}
export const initialRun = (): RunState => ({
  phase: "loading",
  step: 0,
  mistakes: 0,
  replays: 0,
  hint: 0,
  interrupted: false,
  choices: [],
  feedback: null,
  reason: null,
  lastEvent: null,
});
export type RunAction =
  | { type: "reset" }
  | { type: "listen"; replay?: boolean }
  | { type: "ready" }
  | {
      type: "choose";
      index: number;
      event: string;
      expected: number;
      length: number;
      guided: boolean;
    }
  | { type: "feedbackDone"; correct: boolean; guided: boolean; length: number }
  | { type: "hint"; level: number }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "error" };
export function runReducer(s: RunState, a: RunAction): RunState {
  switch (a.type) {
    case "reset":
      return initialRun();
    case "listen":
      if (
        s.phase === "listening" ||
        s.phase === "feedback" ||
        s.phase === "completed"
      )
        return s;
      return {
        ...s,
        phase: "listening",
        feedback: null,
        reason: null,
        replays: s.replays + (a.replay ? 1 : 0),
      };
    case "ready":
      return s.phase === "listening" ? { ...s, phase: "answering" } : s;
    case "choose":
      if (s.phase !== "answering" || s.lastEvent === a.event) return s;
      return {
        ...s,
        phase: "feedback",
        feedback: a.index,
        reason: a.index === a.expected ? "correct" : "retry",
        choices: [...s.choices, a.index],
        mistakes: s.mistakes + (a.index === a.expected ? 0 : 1),
        lastEvent: a.event,
      };
    case "feedbackDone":
      if (s.phase !== "feedback") return s;
      if (!a.correct) return { ...s, phase: "answering" };
      return {
        ...s,
        step: s.step + 1,
        phase:
          s.step + 1 >= a.length
            ? "completed"
            : a.guided
              ? "loading"
              : "answering",
        feedback: null,
        reason: null,
      };
    case "hint":
      return { ...s, hint: Math.max(s.hint, a.level) };
    case "pause":
      return s.phase === "completed"
        ? s
        : { ...s, phase: "paused", interrupted: true };
    case "resume":
      return {
        ...s,
        phase: "loading",
        step: 0,
        feedback: null,
        reason: null,
        interrupted: true,
      };
    case "error":
      return { ...s, phase: "error", interrupted: true };
  }
}
export type ResultKind =
  | "independent"
  | "replayed"
  | "supported"
  | "taught"
  | "skipped"
  | "interrupted";
export function classify(s: RunState, skip = false): ResultKind {
  if (s.interrupted) return "interrupted";
  if (skip) return "skipped";
  if (s.hint >= 3) return "taught";
  if (s.hint > 0 || s.mistakes > 0) return "supported";
  if (s.replays > 0) return "replayed";
  return "independent";
}
