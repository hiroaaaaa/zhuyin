import { describe, it, expect } from "vitest";
import { SYMBOLS, batchSymbols } from "../src/data/symbols";
import {
  makeQuestion,
  adjacent,
  validateQuestion,
  initialRun,
  runReducer,
  classify,
  ALL_DIRS,
  type Game,
} from "../src/core/rules";
import {
  recordResult,
  stats,
  emptyProgress,
  normalizeProgress,
  ROUND_QUESTION_OPTIONS,
} from "../src/core/storage";
const pool = SYMBOLS.map((s) => s.id);
describe("37 個注音與題庫生成", () => {
  it("完整且唯一：21 聲母、13 韻母、3 介音組", () => {
    expect(new Set(pool).size).toBe(37);
    expect(SYMBOLS.map((s) => s.glyph).join("")).toBe(
      "ㄅㄆㄇㄈㄉㄊㄋㄌㄍㄎㄏㄐㄑㄒㄓㄔㄕㄖㄗㄘㄙㄚㄛㄜㄝㄞㄟㄠㄡㄢㄣㄤㄥㄦㄧㄨㄩ",
    );
    expect(SYMBOLS.filter((s) => s.category === "聲母")).toHaveLength(21);
    expect(SYMBOLS.filter((s) => s.category === "韻母")).toHaveLength(13);
  });
  for (const game of ["match", "grid", "command"] as Game[])
    for (let difficulty = 0; difficulty < 4; difficulty++)
      it(`${game} 難度 ${difficulty}：10,000 種子答案合法`, () => {
        for (let seed = 0; seed < 10000; seed++) {
          const q = makeQuestion(game, pool, difficulty, seed, "complete", 3);
          expect(() => validateQuestion(q)).not.toThrow();
          expect(new Set(q.board).size).toBe(q.board.length);
          for (const s of q.steps) {
            expect(q.board[s.target]).toBeDefined();
            if (s.ref !== undefined && s.direction)
              expect(adjacent(s.ref, s.direction, q.cols)).toBe(s.target);
          }
        }
      });
  it("只從已引入池取目標與干擾", () => {
    for (let seed = 0; seed < 200; seed++) {
      const q = makeQuestion("match", pool.slice(0, 3), 3, seed);
      expect(q.board).toHaveLength(3);
      expect(q.board.every((id) => pool.slice(0, 3).includes(id))).toBe(true);
    }
  });
  it("不可重複選項填滿、不使用未引入符號", () => {
    expect(() => makeQuestion("match", pool.slice(0, 2), 0, 1)).toThrow();
    expect(() => makeQuestion("grid", pool.slice(0, 3), 0, 1)).toThrow();
    const q = makeQuestion("grid", pool.slice(0, 8), 1, 2);
    expect(q.cols).toBe(2);
  });
  it("方向不折返、不超界、中央八方向皆正確", () => {
    for (const d of ALL_DIRS) expect(adjacent(4, d, 3)).not.toBeNull();
    expect(adjacent(2, "right", 3)).toBeNull();
    expect(adjacent(0, "up", 3)).toBeNull();
    expect(adjacent(8, "dr", 3)).toBeNull();
    expect(adjacent(4, "ul", 3)).toBe(0);
    expect(adjacent(4, "dr", 3)).toBe(8);
  });
  it("固定種子可重現，不因判斷重新洗牌", () => {
    expect(makeQuestion("command", pool, 2, 42, "complete", 3)).toEqual(
      makeQuestion("command", pool, 2, 42, "complete", 3),
    );
  });
});
describe("指令順序與重複操作", () => {
  it("語音未完成不能作答，錯序不跳步", () => {
    let s = initialRun();
    s = runReducer(s, { type: "listen" });
    s = runReducer(s, {
      type: "choose",
      index: 1,
      event: "a",
      expected: 0,
      length: 3,
      guided: false,
    });
    expect(s.phase).toBe("listening");
    s = runReducer(s, { type: "ready" });
    s = runReducer(s, {
      type: "choose",
      index: 1,
      event: "a",
      expected: 0,
      length: 3,
      guided: false,
    });
    expect(s.mistakes).toBe(1);
    s = runReducer(s, {
      type: "feedbackDone",
      correct: false,
      guided: false,
      length: 3,
    });
    expect(s.step).toBe(0);
    expect(s.phase).toBe("answering");
  });
  it("連點不會跳步；完整模式正確前綴保留", () => {
    let s = runReducer(runReducer(initialRun(), { type: "listen" }), {
      type: "ready",
    });
    const a = {
      type: "choose" as const,
      index: 0,
      event: "a",
      expected: 0,
      length: 3,
      guided: false,
    };
    s = runReducer(s, a);
    expect(runReducer(s, { ...a, event: "b" }).choices).toHaveLength(1);
    s = runReducer(s, {
      type: "feedbackDone",
      correct: true,
      guided: false,
      length: 3,
    });
    expect(s.step).toBe(1);
    expect(s.phase).toBe("answering");
    s = runReducer(s, { ...a, index: 0, event: "wrong", expected: 2 });
    s = runReducer(s, {
      type: "feedbackDone",
      correct: false,
      guided: false,
      length: 3,
    });
    expect(s.step).toBe(1);
  });
  it("逐步模式需重新聽下一步；暫停重開不列獨立", () => {
    let s = runReducer(runReducer(initialRun(), { type: "listen" }), {
      type: "ready",
    });
    s = runReducer(s, {
      type: "choose",
      index: 0,
      event: "a",
      expected: 0,
      length: 2,
      guided: true,
    });
    s = runReducer(s, {
      type: "feedbackDone",
      correct: true,
      guided: true,
      length: 2,
    });
    expect(s.phase).toBe("loading");
    s = runReducer(s, { type: "pause" });
    s = runReducer(s, { type: "resume" });
    expect(s.step).toBe(0);
    expect(classify(s)).toBe("interrupted");
  });
  it("誠實區分重聽、協助、教學、略過及中斷", () => {
    expect(classify(initialRun())).toBe("independent");
    expect(classify({ ...initialRun(), replays: 1 })).toBe("replayed");
    expect(classify({ ...initialRun(), mistakes: 1 })).toBe("supported");
    expect(classify({ ...initialRun(), hint: 3 })).toBe("taught");
    expect(classify(initialRun(), true)).toBe("skipped");
    expect(classify({ ...initialRun(), interrupted: true }, true)).toBe(
      "interrupted",
    );
  });
});
describe("進度統計與中斷恢復", () => {
  it("舊紀錄及不合法題數恢復為 5 題，保留原有學習紀錄", () => {
    const { roundQuestions: _, ...legacy } = {
      ...emptyProgress(),
      introduced: ["s01"],
      stickers: 3,
    };
    for (const value of [undefined, 0, -1, 6, 100, "10", NaN]) {
      const migrated = normalizeProgress({
        ...legacy,
        roundQuestions: value,
      } as unknown as ReturnType<typeof emptyProgress>);
      expect(migrated.roundQuestions).toBe(5);
      expect(migrated.introduced).toEqual(["s01"]);
      expect(migrated.stickers).toBe(3);
    }
    for (const roundQuestions of ROUND_QUESTION_OPTIONS) {
      expect(
        normalizeProgress({ ...emptyProgress(), roundQuestions })
          .roundQuestions,
      ).toBe(roundQuestions);
    }
  });
  it("完成覆蓋預存中斷；重複完成不灌分", () => {
    const q = makeQuestion("match", pool, 0, 999);
    let p = recordResult(emptyProgress(), q, initialRun(), "interrupted", "r1");
    expect(p.results).toHaveLength(1);
    p = recordResult(p, q, initialRun(), "independent", "r1");
    expect(p.results).toHaveLength(1);
    expect(p.results[0].kind).toBe("independent");
    expect(recordResult(p, q, initialRun(), "independent", "r1")).toBe(p);
  });
  it("分母包含略過與教學，排除技術中斷", () => {
    let p = emptyProgress();
    const kinds = [
      "independent",
      "replayed",
      "supported",
      "taught",
      "skipped",
      "interrupted",
    ] as const;
    kinds.forEach((kind, i) => {
      p = recordResult(
        p,
        makeQuestion("match", pool, 0, 1000 + i),
        initialRun(),
        kind,
        "r2",
      );
    });
    expect(stats(p.results)).toEqual({
      effective: 5,
      independent: 1,
      percent: 20,
    });
    expect(stats([]).percent).toBeNull();
  });
});

it("九個分組可完整選到 37 個注音，首末組對應顯示編號", () => {
  expect(
    batchSymbols(1)
      .map((id) => SYMBOLS.find((s) => s.id === id)!.glyph)
      .join(""),
  ).toBe("ㄅㄆㄇㄈ");
  expect(
    batchSymbols(9)
      .map((id) => SYMBOLS.find((s) => s.id === id)!.glyph)
      .join(""),
  ).toBe("ㄣㄤㄥ");
  expect(
    Array.from({ length: 9 }, (_, i) => batchSymbols(i + 1))
      .flat()
      .sort(),
  ).toEqual(SYMBOLS.map((s) => s.id).sort());
});
