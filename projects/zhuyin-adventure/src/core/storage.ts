import { openDB } from "idb";
import type { Game, Question, ResultKind, RunState } from "./rules";
import type { AdvancedGame } from "../data/advanced";
import {
  advancedKind,
  type AdvancedAttempt,
  type AdvancedQuestion,
} from "./advanced-rules";
export const ROUND_QUESTION_OPTIONS = [5, 10, 15, 20, 30] as const;
export type RoundQuestionCount = (typeof ROUND_QUESTION_OPTIONS)[number];
export const DEFAULT_ROUND_QUESTIONS: RoundQuestionCount = 5;
export interface Result {
  id: string;
  round: string;
  game: Game | AdvancedGame;
  target: string;
  difficulty: number;
  mode: string;
  steps: number;
  kind: ResultKind;
  mistakes: number;
  replays: number;
  hint: number;
  time: number;
  seed?: number;
}
export interface Progress {
  introduced: string[];
  listens: Record<string, number>;
  results: Result[];
  stickers: number;
  rounds: string[];
  roundQuestions: RoundQuestionCount;
  advancedWords: string[];
  introducedTones: number[];
}
export const emptyProgress = (): Progress => ({
  introduced: [],
  listens: {},
  results: [],
  stickers: 0,
  rounds: [],
  roundQuestions: DEFAULT_ROUND_QUESTIONS,
  advancedWords: [],
  introducedTones: [],
});
export function normalizeProgress(p: Progress): Progress {
  return {
    ...p,
    advancedWords: Array.isArray(p.advancedWords) ? p.advancedWords : [],
    introducedTones: Array.isArray(p.introducedTones) ? p.introducedTones : [],
    roundQuestions: ROUND_QUESTION_OPTIONS.includes(p.roundQuestions)
      ? p.roundQuestions
      : DEFAULT_ROUND_QUESTIONS,
  };
}
function dbPromise() {
  return openDB("zhuyin-adventure-v1", 1, {
    upgrade(db) {
      db.createObjectStore("local");
    },
  });
}
export async function loadProgress(): Promise<Progress> {
  return normalizeProgress(
    (await (await dbPromise()).get("local", "progress")) ?? emptyProgress(),
  );
}
export async function saveProgress(p: Progress) {
  await (await dbPromise()).put("local", p, "progress");
}
export async function clearProgress() {
  await (await dbPromise()).clear("local");
}
export function recordResult(
  p: Progress,
  q: Question,
  s: RunState,
  kind: ResultKind,
  round: string,
): Progress {
  const previous = p.results.find((r) => r.id === q.id);
  if (previous && previous.kind !== "interrupted") return p;
  const result: Result = {
    id: q.id,
    round,
    game: q.game,
    target: q.target,
    difficulty: q.difficulty,
    mode: q.mode,
    steps: q.steps.length,
    kind,
    mistakes: s.mistakes,
    replays: s.replays,
    hint: s.hint,
    time: Date.now(),
  };
  return {
    ...p,
    results: [...p.results.filter((r) => r.id !== q.id), result].slice(-1000),
  };
}
export function stats(results: Result[]) {
  const effective = results.filter((r) => r.kind !== "interrupted");
  const independent = effective.filter((r) => r.kind === "independent").length;
  return {
    effective: effective.length,
    independent,
    percent: effective.length
      ? Math.round((independent / effective.length) * 100)
      : null,
  };
}
export function recordAdvancedResult(
  p: Progress,
  q: AdvancedQuestion,
  state: AdvancedAttempt,
  round: string,
  skipped = false,
): Progress {
  const previous = p.results.find((r) => r.id === q.id);
  if (previous && previous.kind !== "interrupted") return p;
  const result: Result = {
    id: q.id,
    round,
    game: q.game,
    target: q.target,
    difficulty: q.difficulty,
    mode: q.mode,
    steps: q.game === "memory" ? q.cards!.length / 2 : q.answers.length,
    kind: advancedKind(state, skipped),
    mistakes: state.mistakes,
    replays: state.replays,
    hint: state.hints,
    time: Date.now(),
    seed: q.seed,
  };
  return {
    ...p,
    results: [...p.results.filter((r) => r.id !== q.id), result].slice(-1000),
  };
}
