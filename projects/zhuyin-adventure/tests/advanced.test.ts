import { describe, it, expect } from "vitest";
import { SYMBOLS } from "../src/data/symbols";
import {
  ADVANCED_GAMES,
  WORDS,
  TONE_SAMPLES,
  word,
  type AdvancedGame,
} from "../src/data/advanced";
import {
  makeAdvancedQuestion,
  validateAdvancedQuestion,
  requirements,
  spellingCandidates,
  initialAdvancedAttempt,
  advanceAnswer,
  chooseMemory,
  advancedKind,
  type AdvancedConfig,
} from "../src/core/advanced-rules";
import {
  emptyProgress,
  normalizeProgress,
  recordAdvancedResult,
  stats,
} from "../src/core/storage";
const pool = {
  ...emptyProgress(),
  introduced: SYMBOLS.map((s) => s.id),
  advancedWords: WORDS.map((w) => w.id),
  introducedTones: [1, 2, 3, 4, 5],
};
const config = (
  game: AdvancedGame,
  difficulty = 0,
  mode: "guided" | "complete" = "complete",
): AdvancedConfig => ({ game, difficulty, mode, questionCount: 5 });
describe("六款進階題庫", () => {
  it("入門擴充兩符號詞語；每種詞語輪完才重複，三十題均衡", () => {
    const cfg = config("train");
    const count = WORDS.filter((w) => w.parts.length === 2).length;
    expect(count).toBeGreaterThanOrEqual(12);
    expect(spellingCandidates(cfg, pool)).toHaveLength(count);
    for (let seed = 0; seed < 200; seed++) {
      const recent: string[] = [];
      for (let n = 0; n < 30; n++) {
        const q = makeAdvancedQuestion(cfg, pool, seed * 31 + n, recent);
        expect(word(q.target).parts).toHaveLength(2);
         expect(q.target).not.toBe(recent.at(-1));
        recent.push(q.target);
        if (n < count) expect(new Set(recent).size).toBe(n + 1);
      }
      const counts = spellingCandidates(cfg, pool).map(
        (w) => recent.filter((id) => id === w.id).length,
      );
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    }
  });
  it("只學過雞、貓仍只出這兩詞；學完新詞才擴充，不偷引入", () => {
    const small = { ...pool, advancedWords: ["cat", "chicken"] };
    const recent: string[] = [];
    for (let i = 0; i < 30; i++) {
      const q = makeAdvancedQuestion(config("train"), small, i, recent);
      expect(["cat", "chicken"]).toContain(q.target);
      expect(q.target).not.toBe(recent.at(-1));
      recent.push(q.target);
    }
    expect(spellingCandidates(config("train"), small)).toHaveLength(2);
    expect(
      spellingCandidates(config("train", 1), pool).every(
        (w) => w.parts.length === 2,
      ),
    ).toBe(true);
  });
  it("混合難度同時有兩、三符號，超過十個可用物品", () => {
    for (const game of ["train", "detective"] as AdvancedGame[]) {
      const w = spellingCandidates(config(game, 2), pool);
      expect(w.length).toBeGreaterThan(10);
      expect(w.some((x) => x.parts.length === 2)).toBe(true);
      expect(w.some((x) => x.parts.length === 3)).toBe(true);
    }
  });
  it("四款出題遊戲：連續十題不重複主目標", () => {
    for (const game of ["train", "tone", "detective", "shop"] as AdvancedGame[]) {
      for (let seed = 1; seed < 80; seed++) {
        const recent: string[] = [];
        for (let n = 0; n < 10; n++) {
          const q = makeAdvancedQuestion(config(game), pool, seed * 100 + n, recent);
          expect(recent).not.toContain(q.target);
          recent.push(q.target);
        }
      }
    }
  });
  it("聲調能重用詞語音檔，翻翻樂卡牌與尋寶中心盡可能輪替", () => {
    const toneRecent: string[] = [];
    for (let n = 0; n < 10; n++) {
      const q = makeAdvancedQuestion(config("tone"), pool, n + 987, toneRecent);
      expect(q.clips.at(-1)).toMatch(new RegExp("^advanced/(tone-|word-)"));
      toneRecent.push(q.target);
    }
    for (const game of ["memory", "treasure"] as AdvancedGame[]) {
      const recent: string[] = [];
      for (let n = 0; n < 8; n++) {
        const q = makeAdvancedQuestion(config(game), pool, n + 2222, recent);
        for (const id of q.target.split("+"))
          expect(recent.flatMap((old) => old.split("+"))).not.toContain(id);
        recent.push(q.target);
      }
    }
  });
  for (const game of Object.keys(ADVANCED_GAMES) as AdvancedGame[])
    for (let d = 0; d < 4; d++)
      it(`${game} 難度 ${d}：1,000 種子合法且可重現`, () => {
        for (let seed = 0; seed < 1000; seed++) {
          const q = makeAdvancedQuestion(config(game, d), pool, seed);
          expect(() => validateAdvancedQuestion(q, pool)).not.toThrow();
          if (seed < 10)
            expect(makeAdvancedQuestion(config(game, d), pool, seed)).toEqual(
              q,
            );
          if (game === "train")
            expect(q.answers).toEqual([
              ...word(q.words[0]).parts,
              ...(d === 3 ? [`tone-${word(q.words[0]).tone}`] : []),
            ]);
          if (game === "detective") {
            expect(q.answers).toEqual([word(q.words[0]).parts[q.missing!]]);
            if (d === 3) expect(q.replacement).not.toBe(q.answers[0]);
          }
          if (game === "tone")
            expect(q.answers).toEqual(
              q.words.map(
                (id) => `tone-${TONE_SAMPLES.find((s) => s.id === id)!.tone}`,
              ),
            );
          if (game === "shop") {
            expect(q.answers).toEqual(q.words);
            expect(q.answers).toHaveLength(Math.max(1, d));
            expect(new Set(q.answers).size).toBe(q.answers.length);
            expect(q.clips).toEqual(["advanced/shop-help"]);
          }
          if (game === "memory") {
            expect(q.cards).toHaveLength(d === 3 ? 8 : (d + 2) * 2);
            expect(new Set(q.cards!.map((c) => c.id)).size).toBe(
              q.cards!.length,
            );
          }
          if (game === "treasure") {
            let row = 1,
              col = 1;
            const delta = {
              up: [-1, 0],
              down: [1, 0],
              left: [0, -1],
              right: [0, 1],
              ul: [-1, -1],
              ur: [-1, 1],
              dl: [1, -1],
              dr: [1, 1],
            };
            q.directions!.forEach((direction, i) => {
              row += delta[direction][0];
              col += delta[direction][1];
              expect(row).toBeGreaterThanOrEqual(0);
              expect(row).toBeLessThan(3);
              expect(col).toBeGreaterThanOrEqual(0);
              expect(col).toBeLessThan(3);
              expect(q.answers[i]).toBe(`cell-${row * 3 + col}`);
              expect(q.stepClips![i][1]).toBe(`advanced/move-${direction}`);
            });
          }
        }
      });
  it("禁止尚未教過的詞語與聲調；不能用符號勾選冒充詞語已教", () => {
    expect(
      requirements(config("train"), { ...pool, advancedWords: [] }),
    ).not.toBeNull();
    expect(
      requirements(config("tone"), { ...pool, introducedTones: [] }),
    ).not.toBeNull();
    expect(
      requirements(config("shop", 3), {
        ...pool,
        advancedWords: pool.advancedWords.slice(0, 3),
      }),
    ).not.toBeNull();
    expect(
      requirements(config("memory", 2), {
        ...pool,
        introduced: pool.introduced.slice(0, 3),
      }),
    ).not.toBeNull();
    expect(
      requirements(config("treasure"), {
        ...pool,
        introduced: pool.introduced.slice(0, 8),
      }),
    ).not.toBeNull();
    expect(() =>
      makeAdvancedQuestion(config("train"), emptyProgress(), 2),
    ).toThrow();
  });
  it("已教池縮小後不偷放未引入干擾符號", () => {
    const small = {
      ...pool,
      introduced: SYMBOLS.filter((s) => "ㄇㄠㄐㄧ".includes(s.glyph)).map(
        (s) => s.id,
      ),
      advancedWords: ["cat", "chicken"],
    };
    for (let seed = 0; seed < 100; seed++) {
      const q = makeAdvancedQuestion(config("train"), small, seed);
      expect(q.choices.every((id) => small.introduced.includes(id))).toBe(true);
      expect(q.words.every((id) => small.advancedWords.includes(id))).toBe(
        true,
      );
    }
  });
});
describe("順序、翻牌與紀錄", () => {
  it("錯序及錯答不跳步，完成後不多記一步", () => {
    const q = makeAdvancedQuestion(config("train", 3), pool, 25);
    let s = initialAdvancedAttempt();
    s = advanceAnswer(q, s, q.answers[1]);
    expect(s.step).toBe(0);
    expect(s.mistakes).toBe(1);
    q.answers.forEach((answer) => {
      s = advanceAnswer(q, s, answer);
    });
    expect(s.step).toBe(q.answers.length);
    expect(advanceAnswer(q, s, q.answers[0])).toBe(s);
    expect(advancedKind(s)).toBe("supported");
  });
  it("重複翻同張牌、已配對牌及第三張牌無效；每對恰有一張聲音卡", () => {
    const q = makeAdvancedQuestion(config("memory"), pool, 100);
    const a = q.cards![0],
      b = q.cards!.find((c) => c.pair === a.pair && c.id !== a.id)!;
    let r = chooseMemory(q.cards!, [], [], a.id);
    expect(r.outcome).toBe("open");
    expect(chooseMemory(q.cards!, r.matched, r.open, a.id).outcome).toBe(
      "ignored",
    );
    r = chooseMemory(q.cards!, r.matched, r.open, b.id);
    expect(r.outcome).toBe("match");
    expect(r.matched).toHaveLength(1);
    expect(
      chooseMemory(q.cards!, r.matched, r.open, q.cards![2].id).outcome,
    ).toBe("ignored");
    expect(chooseMemory(q.cards!, r.matched, [], a.id).outcome).toBe("ignored");
    const c = q.cards!.find((c) => c.pair !== a.pair)!;
    expect(chooseMemory(q.cards!, [], [a.id], c.id).outcome).toBe("miss");
  });
  it("翻翻樂四種難度的每張字圖及聲音卡都播放同一個正確讀音", () => {
    for (let difficulty = 0; difficulty < 4; difficulty++) {
      const q = makeAdvancedQuestion(config("memory", difficulty), pool, 123);
      for (const card of q.cards!) {
        expect(card.clip).toBeTruthy();
        const partner = q.cards!.find(
          (c) => c.pair === card.pair && c.id !== card.id,
        )!;
        expect(card.clip).toBe(partner.clip);
        expect(card.kind === "sound").not.toBe(partner.kind === "sound");
      }
    }
  });
  it("舊版資料保留題數與學習紀錄，新欄位補空陣列", () => {
    const {
      advancedWords: _,
      introducedTones: __,
      ...old
    } = { ...pool, roundQuestions: 20 as const, stickers: 3 };
    const p = normalizeProgress(old as typeof pool);
    expect(p.advancedWords).toEqual([]);
    expect(p.introducedTones).toEqual([]);
    expect(p.roundQuestions).toBe(20);
    expect(p.stickers).toBe(3);
  });
  it("訂單讀音提示不列獨立；中斷占位覆寫，不重複灌分", () => {
    const q = makeAdvancedQuestion(config("shop", 2), pool, 5);
    const initial = initialAdvancedAttempt();
    let p = recordAdvancedResult(
      pool,
      q,
      { ...initial, interrupted: true },
      "r",
    );
    expect(stats(p.results).effective).toBe(0);
    p = recordAdvancedResult(p, q, { ...initial, step: 2, hints: 1 }, "r");
    expect(p.results[0].kind).toBe("supported");
    expect(stats(p.results).effective).toBe(1);
    expect(recordAdvancedResult(p, q, initial, "r")).toBe(p);
    expect(advancedKind({ ...initial, hints: 3 })).toBe("taught");
    expect(advancedKind({ ...initial, replays: 1 })).toBe("replayed");
    expect(advancedKind({ ...initial, interrupted: true })).toBe("interrupted");
  });
});
