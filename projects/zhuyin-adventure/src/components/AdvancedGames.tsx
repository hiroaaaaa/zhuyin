import { useEffect, useRef, useState } from "react";
import {
  ADVANCED_GAMES,
  WORDS,
  TONES,
  TONE_SAMPLES,
  word,
  tone,
  toneSample,
  wordClip,
  type AdvancedGame,
  type Word,
} from "../data/advanced";
import { symbol } from "../data/symbols";
import { audio } from "../core/audio";
import {
  makeAdvancedQuestion,
  requirements,
  eligibleWords,
  spellingCandidates,
  initialAdvancedAttempt,
  advanceAnswer,
  chooseMemory,
  advancedKind,
  routeText,
  wordNotation,
  type AdvancedConfig,
  type AdvancedAttempt,
  type AdvancedQuestion,
} from "../core/advanced-rules";
import { recordAdvancedResult, type Progress } from "../core/storage";
import { DIRECTIONS, type ResultKind } from "../core/rules";
import { Button, Header, Modal, Glyph, Bunny, navigate } from "./ui";
import { WordArt } from "./WordArt";
import { useAutoAdvance } from "./useAutoAdvance";
const BASE = import.meta.env.BASE_URL;
type Update = (fn: (p: Progress) => Progress) => void;
const KINDS: Record<ResultKind, string> = {
  independent: "獨立完成",
  replayed: "重聽後完成",
  supported: "協助後完成",
  taught: "一起練習",
  skipped: "略過",
  interrupted: "中斷／重新練習",
};
export function Spelling({ item }: { item: Word }) {
  return (
    <span className="word-spelling" role="img" aria-label={wordNotation(item)}>
      {item.parts.map((id, i) => (
        <Glyph key={i} id={id} />
      ))}
      {item.tone !== 1 && <sup>{tone(item.tone).mark}</sup>}
    </span>
  );
}
function ToneGraphic({ id }: { id: number }) {
  const t = tone(id);
  return (
    <>
      <span className="tone-mark">{id === 1 ? "一聲" : t.mark}</span>
      <svg className="tone-curve" viewBox="0 0 100 80" aria-hidden="true">
        <path
          d={t.path}
          fill="none"
          stroke="currentColor"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <small>{t.label}</small>
    </>
  );
}
export function AdvancedSetup({
  game,
  progress,
  update,
  begin,
}: {
  game: AdvancedGame;
  progress: Progress;
  update: Update;
  begin: (config: AdvancedConfig) => Promise<void>;
}) {
  const [difficulty, setDifficulty] = useState(0);
  const [mode, setMode] = useState<"guided" | "complete">("guided");
  const [teaching, setTeaching] = useState("");
  const [error, setError] = useState("");
  const guard = useRef(false),
    live = useRef(true);
  useEffect(
    () => () => {
      live.current = false;
      audio.stop();
    },
    [],
  );
  const g = ADVANCED_GAMES[game];
  const config = {
    game,
    difficulty,
    mode,
    questionCount: progress.roundQuestions,
  };
  const reason = requirements(config, progress);
  const candidates = spellingCandidates(config, progress);
  async function teach(id: string, isTone = false) {
    if (guard.current) return;
    guard.current = true;
    setTeaching(id);
    setError("");
    try {
      const played = await audio.play([
        isTone ? `advanced/teach-tone-${id}` : wordClip(id),
      ]);
      if (played && live.current)
        update((p) =>
          isTone
            ? {
                ...p,
                introducedTones: [
                  ...new Set([...p.introducedTones, Number(id)]),
                ],
              }
            : { ...p, advancedWords: [...new Set([...p.advancedWords, id])] },
        );
    } catch {
      if (live.current) setError("聲音未能播放。請連線並再點一次喇叭。");
    } finally {
      guard.current = false;
      if (live.current) setTeaching("");
    }
  }
  return (
    <>
      <Header title={g.title} />
      <div className={`setup-hero ${g.color}`}>
        <span className="game-icon" aria-hidden="true">
          {g.icon}
        </span>
        <h2>{g.help}</h2>
        <Button
          secondary
          disabled={!!teaching}
          onClick={() => {
            void audio
              .play([
                `advanced/${game === "treasure" ? "route-ready" : game === "detective" ? "detective-help" : game === "tone" ? "tone-help" : game + "-help"}`,
              ])
              .catch(() => setError("請再點一次喇叭。"));
          }}
        >
          ♪ 聽玩法
        </Button>
      </div>
      <section className="settings">
        <h2>小冒險的難度</h2>
        <div className="option-grid">
          {g.levels.map((label, i) => (
            <button
              key={label}
              aria-pressed={difficulty === i}
              className={`option ${difficulty === i ? "selected" : ""}`}
              onClick={() => setDifficulty(i)}
            >
              {label}
            </button>
          ))}
        </div>
        {game === "treasure" && (
          <>
            <h2>怎麼聽路線？</h2>
            <div className="option-grid">
              <button
                className={`option ${mode === "guided" ? "selected" : ""}`}
                aria-pressed={mode === "guided"}
                onClick={() => setMode("guided")}
              >
                走一步，聽下一步
              </button>
              <button
                className={`option ${mode === "complete" ? "selected" : ""}`}
                aria-pressed={mode === "complete"}
                onClick={() => setMode("complete")}
              >
                一次聽完，再出發
              </button>
            </div>
          </>
        )}
      </section>
      <p className="muted centered">
        每回合 {progress.roundQuestions} 題
        {game === "memory" ? "；每題是一組翻牌配對" : "，沒有倒數計時"}
        。家長可調整題數。答對後會自動進入下一題，完成最後一題會自動領取貼紙。
      </p>
      {game === "train" && (
        <div className="note" role="status">
          <p>
            本難度目前可出 {candidates.length} 個詞語
            {candidates.length > 0
              ? `：${candidates.map((w) => w.text).join("、")}`
              : ""}
            。
          </p>
          <p>
            {candidates.length >= progress.roundQuestions
              ? "這一回合會先出不同詞語。"
              : `可用詞語各出一次後才重複；${progress.roundQuestions} 題若多於可用詞語，就會輪流複習。可在下方小教室學習更多符合難度的詞語。`}
          </p>
        </div>
      )}
      {reason ? (
        <div className="note">
          <p>{reason}</p>
          <Button secondary onClick={() => navigate("/explore")}>
            先去認識注音
          </Button>
        </div>
      ) : (
        <Button disabled={!!teaching} onClick={() => void begin(config)}>
          開始小冒險 →
        </Button>
      )}
      {error && (
        <p className="warning" role="alert">
          {error}
        </p>
      )}
      {!["treasure"].includes(game) &&
        !(game === "memory" && difficulty < 3) && (
          <section className="learning-lab">
            <h2>先認識新聲音</h2>
            <p>先聽完整錄音，再加入練習。打勾只代表已聽過，不代表已精熟。</p>
            {game === "tone" ? (
              <>
                <div className="tone-school">
                  {TONES.map((t) => {
                    const sample = TONE_SAMPLES.find(
                      (s) =>
                        s.tone === t.id &&
                        (t.id === 5 ? s.id === "hat" : s.id.startsWith("tang")),
                    )!;
                    const known = sample.parts.every((id) =>
                      progress.introduced.includes(id),
                    );
                    return (
                      <button
                        className={`tone-balloon tone-${t.id}`}
                        aria-label={`聽${t.label}範例${progress.introducedTones.includes(t.id) ? "，已聽過" : ""}`}
                        disabled={!known || !!teaching}
                        onClick={() => void teach(String(t.id), true)}
                        key={t.id}
                      >
                        <ToneGraphic id={t.id} />
                        <span>
                          {progress.introducedTones.includes(t.id)
                            ? "✓ 已聽過"
                            : "♪ 聽聲音"}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="muted">
                  四聲範例使用「湯、糖、躺、燙」（ㄊ、ㄤ）；輕聲範例使用「帽子」（ㄇ、ㄠ、ㄗ）。詞語末音關卡另需認識各詞語中的注音。
                </p>
                <div className="note">
                  一聲不加調號；輕聲較輕短，不是第五條固定音高線。曲線只用於單獨音節的入門示意。
                </div>
              </>
            ) : (
              <>
                <div className="word-school">
                  {WORDS.map((w) => {
                    const known = w.parts.every((id) =>
                      progress.introduced.includes(id),
                    );
                    return (
                      <button
                        key={w.id}
                        disabled={!known || !!teaching}
                        className={`word-teach ${progress.advancedWords.includes(w.id) ? "introduced" : ""}`}
                        aria-label={`聽${w.text}的完整讀音${progress.advancedWords.includes(w.id) ? "，已聽過" : ""}`}
                        onClick={() => void teach(w.id)}
                      >
                        <WordArt id={w.id} />
                        <Spelling item={w} />
                        <span>
                          {known
                            ? progress.advancedWords.includes(w.id)
                              ? "✓ 已聽過"
                              : "♪ 聽完整聲音"
                            : "先認識注音"}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="muted">
                  已可練習 {eligibleWords(progress).length} / {WORDS.length}{" "}
                  個詞語。灰色卡片需要先認識其中注音；家長也可在陪玩設定確認已學內容。
                </p>
              </>
            )}
            <p className="muted">
              原有 18 個詞語使用預製錄音；新增詞語使用裝置的繁體中文朗讀功能（發音品質依裝置而異）。家長請協助確認讀音。
            </p>
          </section>
        )}
    </>
  );
}

type Phase =
  | "loading"
  | "answering"
  | "checking"
  | "completed"
  | "memory-miss"
  | "paused"
  | "error";
export function AdvancedRound({
  config,
  pool,
  update,
  onDone,
}: {
  config: AdvancedConfig;
  pool: Progress;
  update: Update;
  onDone: () => void;
}) {
  const round = useRef(crypto.randomUUID()).current;
  const serial = useRef(0),
    recent = useRef<string[]>(
      pool.results
        .filter((r) => r.game === config.game && r.difficulty === config.difficulty && r.kind !== "interrupted")
        .slice(-120)
        .map((r) => r.target),
    );
  function newQuestion() {
    const q = makeAdvancedQuestion(
      config,
      pool,
      crypto.getRandomValues(new Uint32Array(1))[0],
      recent.current,
    );
    q.id = `${round}-${serial.current++}-${q.seed}`;
    recent.current.push(
      q.game === "detective" && q.difficulty > 0
        ? `${q.target}#${q.missing}`
        : q.target,
    );
    return q;
  }
  const [q, setQ] = useState(newQuestion);
  const [number, setNumber] = useState(0);
  const [attempt, setAttempt] = useState(initialAdvancedAttempt);
  const attemptRef = useRef(attempt);
  const [phase, setPhase] = useState<Phase>("loading"),
    phaseRef = useRef<Phase>("loading");
  const [open, setOpen] = useState<string[]>([]),
    openRef = useRef<string[]>([]);
  const [matched, setMatched] = useState<string[]>([]),
    matchedRef = useRef<string[]>([]);
  const [finished, setFinished] = useState(false),
    [exit, setExit] = useState(false),
    [error, setError] = useState("");
  const [summary, setSummary] = useState<ResultKind[]>([]);
  const [completionPaused, setCompletionPaused] = useState(false);
  const advanced = useRef(new Set<string>());
  const recorded = useRef(new Set<string>()),
    epoch = useRef(0),
    locked = useRef(true);
  const failedPlayback = useRef<{ clips: string[]; after: () => void } | null>(
    null,
  );
  function commit(s: AdvancedAttempt) {
    attemptRef.current = s;
    setAttempt(s);
  }
  function changePhase(p: Phase) {
    phaseRef.current = p;
    setPhase(p);
    locked.current = p !== "answering";
  }
  function memoryState(nextOpen: string[], nextMatched: string[]) {
    openRef.current = nextOpen;
    matchedRef.current = nextMatched;
    setOpen(nextOpen);
    setMatched(nextMatched);
  }
  function record(state: AdvancedAttempt, skip = false) {
    if (recorded.current.has(q.id)) return;
    recorded.current.add(q.id);
    update((p) => recordAdvancedResult(p, q, state, round, skip));
    setSummary((s) => [...s, advancedKind(state, skip)]);
  }
  function instructionClips(state = attemptRef.current) {
    if (q.game !== "memory" && state.step >= q.answers.length)
      return ["voice/correct"];
    if (q.game === "treasure" && config.mode === "guided")
      return state.step === 0
        ? [
            "advanced/route-start",
            `symbols/${q.target}`,
            "advanced/route-ready",
            ...q.stepClips![0],
          ]
        : q.stepClips![state.step];
    return q.clips;
  }
  async function play(clips: string[], after: () => void) {
    const ticket = ++epoch.current;
    failedPlayback.current = null;
    changePhase("loading");
    setError("");
    try {
      const ok = await audio.play(clips);
      if (ok && ticket === epoch.current) after();
    } catch {
      if (ticket === epoch.current) {
        failedPlayback.current = { clips, after };
        commit({ ...attemptRef.current, interrupted: true });
        setError("聲音暫時無法播放，請連線後重試。");
        changePhase("error");
      }
    }
  }
  function retryPlayback() {
    const failed = failedPlayback.current;
    commit({ ...attemptRef.current, replays: attemptRef.current.replays + 1 });
    if (failed) void play(failed.clips, failed.after);
    else listen();
  }
  function listen(replay = false) {
    if (replay)
      commit({
        ...attemptRef.current,
        replays: attemptRef.current.replays + 1,
      });
    if (replay && q.game === "memory" && openRef.current.length) {
      const card = q.cards!.find((c) => c.id === openRef.current.at(-1))!;
      void play([card.clip!], () => changePhase("answering"));
      return;
    }
    void play(instructionClips(), () => {
      const complete =
        q.game === "memory"
          ? matchedRef.current.length === q.cards!.length / 2
          : attemptRef.current.step === q.answers.length;
      if (complete) {
        record(attemptRef.current);
        changePhase("completed");
      } else changePhase("answering");
    });
  }
  useEffect(() => {
    const initial = initialAdvancedAttempt();
    commit(initial);
    memoryState([], []);
    failedPlayback.current = null;
    changePhase("loading");
    update((p) =>
      recordAdvancedResult(p, q, { ...initial, interrupted: true }, round),
    );
    listen();
    return () => {
      epoch.current++;
      audio.stop();
    };
  }, [q.id]);
  function pause() {
    if (phaseRef.current === "completed") {
      if (!finished) setCompletionPaused(true);
      return;
    }
    if (phaseRef.current === "paused") return;
    epoch.current++;
    audio.stop();
    failedPlayback.current = null;
    commit({ ...attemptRef.current, interrupted: true, step: 0 });
    memoryState([], []);
    changePhase("paused");
  }
  useEffect(() => {
    const blur = () => {
      if (document.hidden) pause();
    };
    window.addEventListener("blur", pause);
    document.addEventListener("visibilitychange", blur);
    return () => {
      window.removeEventListener("blur", pause);
      document.removeEventListener("visibilitychange", blur);
    };
  }, [q.id]);
  useAutoAdvance(
    phase === "completed" && !finished && !exit && !completionPaused,
    q.id,
    next,
    () => setCompletionPaused(true),
  );
  async function choose(answer: string) {
    if (locked.current || phaseRef.current !== "answering") return;
    locked.current = true;
    const previous = attemptRef.current,
      next = advanceAnswer(q, previous, answer);
    commit(next);
    changePhase("checking");
    if (next.step === previous.step) {
      await play(["voice/retry"], () => changePhase("answering"));
      return;
    }
    const complete = next.step === q.answers.length;
    let clips = ["voice/correct"];
    if (q.game === "train" && answer.startsWith("s"))
      clips = [`symbols/${answer}`];
    if (complete && ["train", "detective"].includes(q.game))
      clips = ["voice/correct", wordClip(q.words[0])];
    if (q.game === "shop") clips = ["voice/correct", wordClip(answer)];
    if (!complete && q.game === "treasure" && config.mode === "guided")
      clips.push(...q.stepClips![next.step]);
    await play(clips, () => {
      if (complete) {
        record(next);
        changePhase("completed");
      } else changePhase("answering");
    });
  }
  async function flip(id: string) {
    if (locked.current || phaseRef.current !== "answering") return;
    const outcome = chooseMemory(
      q.cards!,
      matchedRef.current,
      openRef.current,
      id,
    );
    if (outcome.outcome === "ignored") return;
    locked.current = true;
    changePhase("checking");
    memoryState(outcome.open, outcome.matched);
    const card = q.cards!.find((c) => c.id === id)!;
    const clips = card.clip ? [card.clip] : [];
    if (outcome.outcome === "match") clips.push("voice/correct");
    await play(clips, () => {
      if (outcome.outcome === "miss") {
        commit({
          ...attemptRef.current,
          mistakes: attemptRef.current.mistakes + 1,
        });
        changePhase("memory-miss");
      } else if (outcome.outcome === "match") {
        const next = { ...attemptRef.current, step: outcome.matched.length };
        commit(next);
        if (outcome.matched.length === q.cards!.length / 2) {
          record(next);
          changePhase("completed");
        } else {
          memoryState([], outcome.matched);
          changePhase("answering");
        }
      } else changePhase("answering");
    });
  }
  function hint() {
    if (phaseRef.current !== "answering") return;
    const level = Math.min(3, attemptRef.current.hints + 1);
    commit({ ...attemptRef.current, hints: level });
    const clips =
      level >= 2
        ? ["voice/help"]
        : q.game === "shop"
          ? [wordClip(q.answers[attemptRef.current.step])]
          : q.game === "memory"
            ? ["voice/help"]
            : instructionClips();
    void play(clips, () => changePhase("answering"));
  }
  function next() {
    if (advanced.current.has(q.id)) return;
    advanced.current.add(q.id);
    epoch.current++;
    audio.stop();
    if (number + 1 === config.questionCount) {
      setFinished(true);
      changePhase("completed");
      update((p) =>
        p.rounds.includes(round)
          ? p
          : { ...p, rounds: [...p.rounds, round], stickers: p.stickers + 1 },
      );
      void audio.play(["voice/done"]).catch(() => {});
    } else {
      changePhase("loading");
      setNumber((n) => n + 1);
      setQ(newQuestion());
    }
  }
  function skip() {
    record(attemptRef.current, true);
    next();
  }
  const g = ADVANCED_GAMES[config.game];
  if (finished)
    return (
      <>
        <Header title="小冒險完成！" onBack={onDone} />
        <section className="round-result">
          <Bunny />
          <div className="sticker">✿</div>
          <h2>送你一朵小花！</h2>
          <p>完成 {config.questionCount} 題，謝謝你和小兔一起探索。</p>
          <div className="result-list">
            {summary.map((kind, i) => (
              <div key={i}>
                <span>第 {i + 1} 題</span>
                <strong>{KINDS[kind]}</strong>
              </div>
            ))}
          </div>
          <p>看看遠方、動動身體，再玩下一回。</p>
          <Button onClick={onDone}>回遊戲選單</Button>
        </section>
      </>
    );
  const expected = q.answers[attempt.step];
  const active = phase === "answering";
  const hintClass = (key: string) =>
    attempt.hints >= 2 && key === expected ? "hinted" : "";
  const trainTone =
    q.game === "train" &&
    q.difficulty === 3 &&
    attempt.step === q.parts!.length;
  const bunnyPosition =
    q.game === "treasure"
      ? attempt.step
        ? q.positions![attempt.step - 1]
        : q.start!
      : 0;
  return (
    <div className={`advanced-play advanced-${q.game}`}>
      <Header
        title={g.title}
        onBack={() => {
          pause();
          setExit(true);
        }}
      />
      <div className="round-meta">
        <span>
          第 {number + 1} / {config.questionCount} 題
        </span>
        <progress
          className="round-progress"
          value={number}
          max={config.questionCount}
          aria-label={`已完成 ${number} / ${config.questionCount} 題`}
        />
        <button className="text-button" onClick={pause}>
          暫停
        </button>
      </div>
      <section className="advanced-instruction" aria-live="polite">
        <span aria-hidden="true">♪</span>
        <div>
          <h2>
            {phase === "completed"
              ? "找到了！"
              : phase === "loading" || phase === "checking"
                ? "小耳朵，先聽聲音…"
                : q.game === "train"
                  ? trainTone
                    ? "最後選聲調"
                    : "依序放進小火車"
                  : q.game === "detective"
                    ? "修好問號那一格"
                    : q.game === "shop"
                      ? `依序找第 ${attempt.step + 1} 樣商品`
                      : q.game === "tone"
                        ? q.difficulty === 3
                          ? "找最後一個字的聲調"
                          : `點第 ${attempt.step + 1} 個聲調`
                        : q.game === "memory"
                          ? phase === "memory-miss"
                            ? "還不是一對，記住位置再找找"
                            : "找一張字圖，再找相同讀音的聲音卡"
                          : `帶小兔走第 ${attempt.step + 1} 步`}
          </h2>
          {q.game === "treasure" && attempt.hints > 0 && (
            <p>
              {config.mode === "guided"
                ? DIRECTIONS[q.directions![attempt.step] || q.directions![0]]
                    .label + "一格"
                : routeText(q)}
            </p>
          )}
          {error && <p role="alert">{error}</p>}
        </div>
      </section>
      {q.game === "train" && (
        <>
          <div className="train-scene">
            <WordArt id={q.words[0]} />
            <div className="train-cars" aria-label="拼音小火車">
              <span className="train-engine" aria-hidden="true">
                🚂
              </span>
              {q.parts!.map((id, i) => (
                <div
                  className={`train-car ${i < attempt.step ? "filled" : ""} ${i === attempt.step ? "current" : ""}`}
                  key={i}
                  aria-label={`第 ${i + 1} 格${i < attempt.step ? "，" + symbol(id).glyph : "，等待放入"}`}
                >
                  {i < attempt.step ? <Glyph id={id} /> : <span>{i + 1}</span>}
                </div>
              ))}
              {q.difficulty === 3 ? (
                <div className="train-car tone-car">
                  {attempt.step > q.parts!.length
                    ? word(q.words[0]).tone === 1
                      ? "✓"
                      : tone(word(q.words[0]).tone).mark
                    : "？"}
                </div>
              ) : (
                <sup
                  className="given-tone"
                  role="img"
                  aria-label={tone(word(q.words[0]).tone).label}
                >
                  {tone(word(q.words[0]).tone).mark}
                </sup>
              )}
            </div>
          </div>
          {trainTone ? (
            <div className="tone-board">
              {TONES.slice(0, 4).map((t) => (
                <button
                  key={t.id}
                  aria-label={t.label}
                  className={`tone-balloon tone-${t.id} ${hintClass("tone-" + t.id)}`}
                  disabled={!active}
                  onClick={() => void choose(`tone-${t.id}`)}
                >
                  <ToneGraphic id={t.id} />
                </button>
              ))}
            </div>
          ) : (
            <div className="advanced-choice-grid">
              {q.choices.map((id) => (
                <button
                  className={`symbol-card ${hintClass(id)}`}
                  key={id}
                  aria-label={symbol(id).glyph}
                  disabled={!active}
                  onClick={() => void choose(id)}
                >
                  <Glyph id={id} />
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {q.game === "detective" && (
        <>
          <div className="detective-scene">
            <WordArt id={q.words[0]} />
            <div className="detective-spelling" aria-label="待補正的拼音">
              {q.parts!.map((id, i) => (
                <div
                  className={`detective-slot ${i === q.missing ? "missing" : ""}`}
                  key={i}
                >
                  {i === q.missing && phase !== "completed" ? (
                    q.replacement ? (
                      <>
                        <Glyph id={q.replacement} />
                        <span className="question-badge">？</span>
                      </>
                    ) : (
                      <span>？</span>
                    )
                  ) : (
                    <Glyph id={id} />
                  )}
                </div>
              ))}
              <sup className="given-tone">
                {tone(word(q.words[0]).tone).mark}
              </sup>
            </div>
          </div>
          <div className="advanced-choice-grid">
            {q.choices.map((id) => (
              <button
                key={id}
                className={`symbol-card ${hintClass(id)}`}
                aria-label={symbol(id).glyph}
                disabled={!active}
                onClick={() => void choose(id)}
              >
                <Glyph id={id} />
              </button>
            ))}
          </div>
        </>
      )}
      {q.game === "tone" && (
        <>
          <div className="tone-sky" aria-hidden="true">
            ☁︎ <span>聽聲音，找高低</span> ☁︎
          </div>
          {q.answers.length > 1 && (
            <div className="step-progress">
              {q.answers.map((_, i) => (
                <span key={i}>{i < attempt.step ? "✓" : i + 1}</span>
              ))}
            </div>
          )}
          <div className={`tone-board ${q.choices.length === 5 ? "five" : ""}`}>
            {q.choices.map((key) => {
              const t = Number(key.slice(5));
              return (
                <button
                  className={`tone-balloon tone-${t} ${hintClass(key)}`}
                  key={key}
                  aria-label={tone(t).label}
                  disabled={!active}
                  onClick={() => void choose(key)}
                >
                  <ToneGraphic id={t} />
                </button>
              );
            })}
          </div>
        </>
      )}
      {q.game === "shop" && (
        <>
          <div className="shop-order">
            <h2>小兔的注音訂單</h2>
            <div
              className={`order-items ${q.words.length === 3 ? "three" : ""}`}
            >
              {q.words.map((id, i) => (
                <div
                  className={`order-line ${i < attempt.step ? "packed" : ""} ${i === attempt.step ? "current" : ""}`}
                  key={id}
                >
                  <span>{i < attempt.step ? "✓" : i + 1}</span>
                  <Spelling item={word(id)} />
                </div>
              ))}
            </div>
            <small>看訂單找圖片；「小兔幫幫我」會讀出目前商品。</small>
          </div>
          <div className={`shop-shelf ${q.choices.length === 9 ? "nine" : ""}`}>
            {q.choices.map((id) => (
              <button
                key={id}
                disabled={
                  !active || q.words.slice(0, attempt.step).includes(id)
                }
                className={`picture-choice ${hintClass(id)} ${q.words.slice(0, attempt.step).includes(id) ? "packed" : ""}`}
                aria-label={`${word(id).text}的圖片`}
                onClick={() => void choose(id)}
              >
                <WordArt id={id} />
                {q.words.slice(0, attempt.step).includes(id) && <span>✓</span>}
              </button>
            ))}
          </div>
          <div
            className="shop-basket"
            aria-label={`籃子裡有 ${attempt.step} 樣商品`}
          >
            🧺{" "}
            {q.words.slice(0, attempt.step).map((id) => (
              <WordArt id={id} key={id} />
            ))}
          </div>
        </>
      )}
      {q.game === "memory" && (
        <>
          <div className="memory-meta">
            已找到 {matched.length} / {q.cards!.length / 2} 對
            <p>一張字圖＋一張聲音，讀音相同就是一對。每張翻開都會念給你聽。</p>
          </div>
          <div
            className={`memory-board ${q.cards!.length === 4 ? "four" : q.cards!.length === 6 ? "six" : ""}`}
          >
            {q.cards!.map((card, i) => {
              const face =
                open.includes(card.id) ||
                matched.includes(card.pair) ||
                attempt.hints >= 2;
              const label = face
                ? q.difficulty === 3
                  ? word(card.value).text
                  : symbol(card.value).glyph
                : "";
              return (
                <button
                  key={card.id}
                  className={`memory-card ${face ? "face-up" : ""} ${matched.includes(card.pair) ? "matched" : ""}`}
                  disabled={
                    !active ||
                    matched.includes(card.pair) ||
                    open.includes(card.id)
                  }
                  aria-label={`第 ${i + 1} 張${face ? `，${card.kind === "sound" ? "聲音" : "字圖"}卡${attempt.hints >= 2 || card.kind !== "sound" ? "，" + label : ""}` : "卡，翻開"}`}
                  onClick={() => void flip(card.id)}
                >
                  {face ? (
                    <>
                      {card.kind === "sound" ? (
                        <>
                          <span className="memory-speaker">♪</span>
                          {attempt.hints >= 2 && <small>{label}</small>}
                        </>
                      ) : card.kind === "picture" ? (
                        <WordArt id={card.value} />
                      ) : (
                        <Glyph id={card.value} />
                      )}
                      <span className="memory-check">
                        {matched.includes(card.pair)
                          ? "✓"
                          : card.kind === "sound"
                            ? "聲音"
                            : "字圖"}
                      </span>
                    </>
                  ) : (
                    <>
                      <span aria-hidden="true">✿</span>
                      <small>
                        {i + 1} · {card.kind === "sound" ? "♪ 聲音" : "字圖"}
                      </small>
                    </>
                  )}
                </button>
              );
            })}
          </div>
          {phase === "memory-miss" && (
            <Button
              secondary
              onClick={() => {
                memoryState([], matchedRef.current);
                changePhase("answering");
              }}
            >
              再找找
            </Button>
          )}
          {active &&
            open.length === 1 &&
            q.cards!.find((c) => c.id === open[0])!.clip && (
              <Button
                secondary
                onClick={() => {
                  commit({
                    ...attemptRef.current,
                    replays: attemptRef.current.replays + 1,
                  });
                  void play(
                    [q.cards!.find((c) => c.id === open[0])!.clip!],
                    () => changePhase("answering"),
                  );
                }}
              >
                ♪ 重聽這張卡
              </Button>
            )}
        </>
      )}
      {q.game === "treasure" && (
        <>
          <div className="treasure-legend">
            <img src={`${BASE}icon.svg`} alt="小兔" />
            小兔在這裡，方向以畫面為準。
            <span>
              {attempt.step} / {q.answers.length} 步
            </span>
          </div>
          <div className="treasure-map">
            {q.board!.map((id, i) => (
              <button
                className={`map-cell ${i === bunnyPosition ? "bunny-here" : ""} ${hintClass("cell-" + i)}`}
                key={i}
                aria-label={`第 ${Math.floor(i / 3) + 1} 列第 ${(i % 3) + 1} 格，${symbol(id).glyph}${i === bunnyPosition ? "，小兔所在" : ""}`}
                disabled={!active}
                onClick={() => void choose(`cell-${i}`)}
              >
                <Glyph id={id} />
                {i === bunnyPosition && (
                  <img className="map-bunny" src={`${BASE}icon.svg`} alt="" />
                )}
                {i !== bunnyPosition &&
                  q.positions!.slice(0, attempt.step).includes(i) && (
                    <span className="map-footprint">✓</span>
                  )}
              </button>
            ))}
          </div>
          <div className="step-progress">
            {q.answers.map((_, i) => (
              <span key={i}>{i < attempt.step ? "✓" : i + 1}</span>
            ))}
          </div>
        </>
      )}
      <div className="game-controls">
        {phase === "completed" ? (
          <p className="auto-next" role="status">
            {number + 1 === config.questionCount
              ? "答對了！準備領小花貼紙…"
              : "答對了！正在前往下一題…"}
          </p>
        ) : (
          <>
            <Button secondary disabled={!active} onClick={() => listen(true)}>
              ♪ 再聽一次
            </Button>
            <Button secondary disabled={!active} onClick={hint}>
              小兔幫幫我
            </Button>
          </>
        )}
      </div>
      {phase === "error" && (
        <>
          <Button onClick={retryPlayback}>重新播放聲音</Button>
          <Button
            secondary
            onClick={() =>
              void audio
                .reset()
                .then(retryPlayback)
                .catch(() => setError("聲音未能啟動，請再點一次重新啟用聲音。"))
            }
          >
            重新啟用聲音
          </Button>
        </>
      )}
      {phase !== "completed" && (
        <button
          className="text-button skip"
          disabled={["loading", "checking"].includes(phase)}
          onClick={skip}
        >
          這題先略過
        </button>
      )}
      {(phase === "paused" || exit || completionPaused) && (
        <Modal title={exit ? "離開小冒險" : "休息一下"}>
          <h2>{exit ? "先回遊戲選單？" : "眼睛休息一下"}</h2>
          <p>
            {recorded.current.has(q.id)
              ? "這題已完成，繼續時會自動進入下一題。"
              : "已完成的題目會保留；繼續時從這一題重新開始，不計為獨立完成。"}
          </p>
          <Button
            onClick={() => {
              void audio
                .unlock()
                .then(() => {
                  setExit(false);
                  setCompletionPaused(false);
                  if (recorded.current.has(q.id)) changePhase("completed");
                  else listen();
                })
                .catch(() => {
                  setExit(false);
                  setCompletionPaused(false);
                  setError("聲音未能啟動，請重新啟用聲音。");
                  changePhase("error");
                });
            }}
          >
            繼續這一題
          </Button>
          <Button
            secondary
            onClick={() => {
              epoch.current++;
              audio.stop();
              onDone();
            }}
          >
            回遊戲選單
          </Button>
        </Modal>
      )}
    </div>
  );
}
