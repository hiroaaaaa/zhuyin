import { Glyph, Bunny, navigate, Button, Header, Modal } from "./components/ui";
import { AudioControls } from "./components/AudioControls";
import { AdvancedSetup, AdvancedRound } from "./components/AdvancedGames";
import { useAutoAdvance } from "./components/useAutoAdvance";
import {
  ADVANCED_GAMES,
  WORDS,
  TONES,
  isAdvancedGame,
  type AdvancedGame,
} from "./data/advanced";
import { wordNotation, type AdvancedConfig } from "./core/advanced-rules";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { SYMBOLS, symbol, batchSymbols, VERSION, BUILD_ID } from "./data/symbols";
import { audio } from "./core/audio";
import {
  ALL_DIRS,
  AXES,
  DIRECTIONS,
  classify,
  initialRun,
  makeQuestion,
  runReducer,
  stepText,
  type Game,
  type Direction,
  type Question,
  type ResultKind,
  type RunState,
} from "./core/rules";
import {
  emptyProgress,
  loadProgress,
  saveProgress,
  clearProgress,
  recordResult,
  stats,
  ROUND_QUESTION_OPTIONS,
  type RoundQuestionCount,
  type Progress,
} from "./core/storage";
import {
  applyUpdate,
  registerOffline,
  type OfflineState,
} from "./core/offline";
const BASE = import.meta.env.BASE_URL;
const GAMES: Record<
  Game,
  {
    title: string;
    tag: string;
    icon: string;
    color: string;
    description: string;
  }
> = {
  explore: {
    title: "認識注音",
    tag: "看一看・聽一聽",
    icon: "◉",
    color: "peach",
    description: "和 37 個注音打招呼",
  },
  match: {
    title: "聽音找注音",
    tag: "仔細聽・找聲音",
    icon: "♪",
    color: "green",
    description: "點出你聽到的注音",
  },
  grid: {
    title: "注音九宮格",
    tag: "上與下・左與右",
    icon: "▦",
    color: "blue",
    description: "找到指定方位的注音",
  },
  command: {
    title: "指令小隊長",
    tag: "先做什麼・再做什麼",
    icon: "⚑",
    color: "yellow",
    description: "聽完指令，照順序完成",
  },
};
const KIND: Record<ResultKind, string> = {
  independent: "獨立完成",
  replayed: "重聽後完成",
  supported: "協助後完成",
  taught: "一起練習",
  skipped: "略過",
  interrupted: "中斷",
};
const ALL_GAMES = { ...GAMES, ...ADVANCED_GAMES };
function useRoute() {
  const [path, setPath] = useState(location.hash.slice(1) || "/");
  useEffect(() => {
    const handler = () => {
      audio.stop();
      setPath(location.hash.slice(1) || "/");
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);
  return path;
}
export default function App() {
  const path = useRoute();
  const [progress, setProgress] = useState<Progress>(emptyProgress());
  const [loaded, setLoaded] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [offline, setOffline] = useState<OfflineState>({
    ready: false,
    update: false,
    error: "",
  });
  const [adult, setAdult] = useState(false);
  const [gate, setGate] = useState(false);
  const [advancedConfig, setAdvancedConfig] = useState<AdvancedConfig | null>(
    null,
  );
  const [roundConfig, setRoundConfig] = useState<{
    game: Game;
    difficulty: number;
    mode: "guided" | "complete";
    steps: number;
    questionCount: RoundQuestionCount;
  } | null>(null);
  const writeQueue = useRef(Promise.resolve());
  useEffect(() => {
    loadProgress()
      .then(setProgress)
      .catch(() => setStorageError(true))
      .finally(() => setLoaded(true));
    return registerOffline(setOffline);
  }, []);
  useEffect(() => {
    if (loaded)
      writeQueue.current = writeQueue.current
        .then(() => saveProgress(progress))
        .catch(() => setStorageError(true));
  }, [progress, loaded]);
  const update = useCallback(
    (fn: (p: Progress) => Progress) => setProgress(fn),
    [],
  );
  function openParent() {
    if (adult) navigate("/parent");
    else setGate(true);
  }
  async function begin(
    game: Game,
    difficulty: number,
    mode: "guided" | "complete",
    steps: number,
  ) {
    try {
      await audio.unlock();
      setRoundConfig({
        game,
        difficulty,
        mode,
        steps,
        questionCount: progress.roundQuestions,
      });
      navigate("/play");
    } catch {
      alert("請再點一次「開始」，開啟遊戲聲音。");
    }
  }
  async function beginAdvanced(config: AdvancedConfig) {
    try {
      await audio.unlock();
      setAdvancedConfig({ ...config, questionCount: progress.roundQuestions });
      navigate("/advanced-play");
    } catch {
      alert("請再點一次「開始」，開啟遊戲聲音。");
    }
  }
  if (!loaded)
    return (
      <main className="app loading">
        <Bunny />
        <p>小兔正在準備樂園…</p>
      </main>
    );
  let content: React.ReactNode;
  if (path === "/parent" && adult)
    content = (
      <Parent
        progress={progress}
        update={update}
        offline={offline}
        storageError={storageError}
        onClear={async () => {
          await writeQueue.current;
          await clearProgress();
          setProgress(emptyProgress());
          setStorageError(false);
        }}
      />
    );
  else if (path === "/advanced-play" && advancedConfig)
    content = (
      <AdvancedRound
        key={advancedConfig.game}
        config={advancedConfig}
        pool={progress}
        update={update}
        onDone={() => navigate("/menu")}
      />
    );
  else if (path.startsWith("/advanced/")) {
    const game = path.split("/")[2];
    content = isAdvancedGame(game) ? (
      <AdvancedSetup
        key={game}
        game={game}
        progress={progress}
        update={update}
        begin={beginAdvanced}
      />
    ) : (
      <Menu progress={progress} openParent={openParent} />
    );
  } else if (path === "/play" && roundConfig)
    content = (
      <Round
        config={roundConfig}
        pool={progress.introduced}
        results={progress.results}
        update={update}
        onDone={() => navigate("/menu")}
      />
    );
  else if (path.startsWith("/setup/")) {
    const game = path.split("/")[2] as Game;
    content =
      GAMES[game] && game !== "explore" ? (
        <Setup game={game} progress={progress} begin={begin} />
      ) : (
        <Menu progress={progress} openParent={openParent} />
      );
  } else if (path.startsWith("/lesson/"))
    content = (
      <Lesson id={path.split("/")[2]} progress={progress} update={update} />
    );
  else if (path === "/explore") content = <Catalog progress={progress} />;
  else if (path === "/menu")
    content = <Menu progress={progress} openParent={openParent} />;
  else
    content = (
      <Home progress={progress} offline={offline} openParent={openParent} />
    );
  return (
    <main className="app">
      {content}
      {storageError && (
        <div className="status warning" role="status">
          目前無法儲存進度；遊戲仍可玩。請大人檢查瀏覽器儲存空間。
        </div>
      )}
      {gate && (
        <AdultGate
          onClose={() => setGate(false)}
          onPass={() => {
            setAdult(true);
            setGate(false);
            navigate("/parent");
          }}
        />
      )}
    </main>
  );
}
function Home({
  progress,
  offline,
  openParent,
}: {
  progress: Progress;
  offline: OfflineState;
  openParent: () => void;
}) {
  return (
    <>
      <header className="homebar">
        <span className="brand">注音冒險樂園</span>
        <button className="text-button" onClick={openParent}>
          家長專區
        </button>
      </header>
      <section className="hero">
        <div className="eyebrow">4–6 歲・和大人一起玩</div>
        <Bunny />
        <h1>
          小耳朵，
          <br />
          一起去冒險！
        </h1>
        <p>
          聽一聽，找一找。
          <br />
          每天認識一點點注音。
        </p>
        <Button
          onClick={() => {
            void audio.unlock().catch(() => {});
            navigate("/menu");
          }}
        >
          開始玩 <span aria-hidden="true">→</span>
        </Button>
        <AudioControls label="♪ 聽小兔說話" clips={["voice/welcome"]} />
      </section>
      <div className="home-summary">
        <span>
          已認識 <strong>{progress.introduced.length}</strong> / 37 個注音
        </span>
        <span>
          貼紙 <strong>{progress.stickers}</strong> 張
        </span>
      </div>
      <p className="status">
        {offline.ready ? "✓ 離線素材已準備好" : "連線中：正在準備離線素材"}
      </p>
      <footer>
        <span className="trial">親子試玩版 v{VERSION} ・ 題庫 {WORDS.length} 詞</span>
        <p>第一次請大人陪玩。沒有帳號，也不錄音。</p>
        {offline.update && (
          <Button secondary onClick={() => void applyUpdate()}>
            更新樂園
          </Button>
        )}
        {offline.error && <p className="warning">{offline.error}</p>}
      </footer>
    </>
  );
}
function Menu({
  progress,
  openParent,
}: {
  progress: Progress;
  openParent: () => void;
}) {
  return (
    <>
      <Header title="今天想玩什麼？" back="/" />
      <div className="intro-row">
        <Bunny small />
        <p>
          選一個小冒險！
          <br />
          <small>
            作答遊戲一回合 {progress.roundQuestions} 題，慢慢玩就好。
          </small>
        </p>
      </div>
      <section className="game-menu">
        {(Object.keys(GAMES) as Game[]).map((game) => {
          const g = GAMES[game];
          return (
            <button
              key={game}
              className={`game-card ${g.color}`}
              onClick={() =>
                navigate(game === "explore" ? "/explore" : `/setup/${game}`)
              }
            >
              <span className="game-icon" aria-hidden="true">
                {g.icon}
              </span>
              <span>
                <strong>{g.title}</strong>
                <small>{g.tag}</small>
              </span>
              <span className="chevron" aria-hidden="true">
                ›
              </span>
            </button>
          );
        })}
      </section>
      <section className="advanced-menu-section">
        <h2>再往前一步的小冒險</h2>
        <p className="muted">拼音、聲調、詞語與記憶；先聽小教室，再開始。</p>
        <div className="game-menu">
          {(Object.keys(ADVANCED_GAMES) as AdvancedGame[]).map((game) => {
            const g = ADVANCED_GAMES[game];
            return (
              <button
                key={game}
                className={`game-card ${g.color}`}
                onClick={() => navigate(`/advanced/${game}`)}
              >
                <span className="game-icon" aria-hidden="true">
                  {g.icon}
                </span>
                <span>
                  <strong>{g.title}</strong>
                  <small>{g.tag}</small>
                </span>
                <span className="chevron" aria-hidden="true">
                  ›
                </span>
              </button>
            );
          })}
        </div>
      </section>
      <div className="summary-card">
        <span>我的小花園</span>
        <strong>✿ {progress.stickers} 張冒險貼紙</strong>
        <p>認識 {progress.introduced.length} / 37 個注音</p>
      </div>
      <button className="text-button" onClick={openParent}>
        家長：查看進度與設定
      </button>
    </>
  );
}
function Catalog({ progress }: { progress: Progress }) {
  const [batch, setBatch] = useState(0);
  const items =
    batch === 0 ? SYMBOLS : SYMBOLS.filter((s) => s.batch === batch);
  return (
    <>
      <Header title="認識注音" />
      <p className="page-lead">
        點一個注音，聽聽它的聲音。
        <br />
        <small>聽兩次，就會加入遊戲。</small>
      </p>
      <div className="chips" aria-label="注音分組">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button
            key={n}
            className={batch === n ? "chip selected" : "chip"}
            aria-pressed={batch === n}
            onClick={() => setBatch(n)}
          >
            {n === 0 ? "全部 37 個" : `第 ${n} 組`}
          </button>
        ))}
      </div>
      <div className="catalog">
        {items.map((s) => (
          <button
            key={s.id}
            className={`symbol-card ${progress.introduced.includes(s.id) ? "introduced" : ""}`}
            aria-label={`${s.glyph}，${progress.introduced.includes(s.id) ? "已認識" : "尚未認識"}`}
            onClick={() => navigate(`/lesson/${s.id}`)}
          >
            <Glyph id={s.id} />
            <span>
              {progress.introduced.includes(s.id) ? "✓ 已認識" : "聽聽看"}
            </span>
          </button>
        ))}
      </div>
      <div className="note">
        小提醒：這裡練習符號和讀音，不做發音評分。可以跟著唸，不必開麥克風。
      </div>
    </>
  );
}
function Lesson({
  id,
  progress,
  update,
}: {
  id: string;
  progress: Progress;
  update: (f: (p: Progress) => Progress) => void;
}) {
  const item = SYMBOLS.find((s) => s.id === id) || SYMBOLS[0];
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const [matching, setMatching] = useState<Question | null>(null);
  const [answer, setAnswer] = useState<number | null>(null);
  const [correct, setCorrect] = useState(false);
  const listens = progress.listens[item.id] || 0;
  useEffect(() => {
    setMatching(null);
    setAnswer(null);
    setCorrect(false);
    setError("");
    setPlaying(false);
    return () => audio.stop();
  }, [id]);
  async function listen() {
    if (playing) return;
    setError("");
    setPlaying(true);
    try {
      const ok = await audio.play([`symbols/${item.id}`]);
      if (ok)
        update((p) => {
          const n = (p.listens[item.id] || 0) + 1;
          return {
            ...p,
            listens: { ...p.listens, [item.id]: n },
            introduced:
              n >= 2 && !p.introduced.includes(item.id)
                ? [...p.introduced, item.id]
                : p.introduced,
          };
        });
    } catch {
      setError("沒有聽到聲音？請確認音量、連線，再試一次。");
    } finally {
      setPlaying(false);
    }
  }
  function match() {
    const pool = Array.from(
      new Set([...progress.introduced, ...batchSymbols(item.batch)]),
    );
    setMatching(
      makeQuestion(
        "explore",
        pool,
        0,
        Date.now() >>> 0,
        "guided",
        1,
        undefined,
        item.id,
      ),
    );
    setAnswer(null);
    setCorrect(false);
    void audio.play(["voice/look-same"]).catch(() => {});
  }
  return (
    <>
      <Header title="和注音打招呼" back="/explore" />
      <div className="lesson">
        <div className="eyebrow">
          {item.category}・第 {item.batch} 組
        </div>
        <div className="big-symbol" aria-label={item.glyph}>
          <Glyph id={item.id} large />
        </div>
        <Button onClick={() => void listen()} disabled={playing}>
          {playing ? "♪ 正在說話…" : "♪ 聽注音"}
        </Button>
        <p role="status">
          {listens >= 2
            ? "✓ 已加入遊戲！"
            : `再聽 ${Math.max(0, 2 - listens)} 次，就能加入遊戲`}
        </p>
        <p className="muted">跟著唸一唸，聲音小一點也沒關係。</p>
        {error && (
          <p className="warning" role="alert">
            {error}
          </p>
        )}
        <div className="lesson-nav">
          <Button
            secondary
            onClick={() =>
              navigate(
                `/lesson/${SYMBOLS[(SYMBOLS.indexOf(item) + 36) % 37].id}`,
              )
            }
          >
            上一個
          </Button>
          <Button
            secondary
            onClick={() =>
              navigate(
                `/lesson/${SYMBOLS[(SYMBOLS.indexOf(item) + 1) % 37].id}`,
              )
            }
          >
            下一個
          </Button>
        </div>
        <Button secondary onClick={match}>
          找一樣的注音
        </Button>
      </div>
      {matching && (
        <section className="practice">
          <h2>找到和上面一樣的注音</h2>
          <div className="board cols-3">
            {matching.board.map((s, i) => (
              <button
                key={s}
                className={`symbol-card ${answer === i ? (correct ? "correct" : "retry") : ""}`}
                aria-label={symbol(s).glyph}
                onClick={() => {
                  setAnswer(i);
                  const ok = i === matching.steps[0].target;
                  setCorrect(ok);
                  void audio
                    .play([ok ? "voice/correct" : "voice/retry"])
                    .catch(() => {});
                }}
              >
                <Glyph id={s} />
              </button>
            ))}
          </div>
          <p role="status">
            {answer !== null
              ? correct
                ? "找到了！這是形狀練習。"
                : "再看看上面的注音，慢慢找。"
              : "點一個一樣的注音"}
          </p>
        </section>
      )}
      <Button secondary onClick={() => navigate("/menu")}>
        去玩其他遊戲
      </Button>
    </>
  );
}
function Setup({
  game,
  progress,
  begin,
}: {
  game: Game;
  progress: Progress;
  begin: (
    g: Game,
    d: number,
    m: "guided" | "complete",
    s: number,
  ) => Promise<void>;
}) {
  const [difficulty, setDifficulty] = useState(0);
  const [steps, setSteps] = useState(1);
  const [mode, setMode] = useState<"guided" | "complete">("guided");
  const [dir, setDir] = useState<Direction>("up");
  const [dirPlaying, setDirPlaying] = useState(false);
  const g = GAMES[game];
  const min = game === "match" ? 3 : difficulty === 0 ? 4 : 9;
  const enough = progress.introduced.length >= min;
  return (
    <>
      <Header title={g.title} />
      <div className={`setup-hero ${g.color}`}>
        <span className="game-icon">{g.icon}</span>
        <h2>{g.description}</h2>
        <p>
          {game === "match"
            ? "聲音說完後，點一個注音。"
            : game === "grid"
              ? "以你看到的畫面為準，找上、下、左、右。"
              : "聽清楚先後順序，再照順序點。"}
        </p>
      </div>
      <section className="settings">
        <h2>小冒險的難度</h2>
        <div className="option-grid">
          {(game === "match"
            ? ["3 個選項", "4 個選項", "6 個選項", "9 個選項"]
            : game === "grid"
              ? [
                  "四格・四方向",
                  "九格・四方向",
                  "九格・八方向",
                  "九格・指定位置",
                ]
              : ["四格・找注音", "九格・加方位", "九格・八方向"]
          ).map((label, i) => (
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
        {game === "command" && (
          <>
            <h2>聽幾個步驟？</h2>
            <div className="option-grid three">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  aria-pressed={steps === n}
                  className={`option ${steps === n ? "selected" : ""}`}
                  onClick={() => setSteps(n)}
                >
                  {n} 個步驟
                </button>
              ))}
            </div>
            <h2>怎麼聽？</h2>
            <div className="option-grid">
              <button
                className={`option ${mode === "guided" ? "selected" : ""}`}
                aria-pressed={mode === "guided"}
                onClick={() => setMode("guided")}
              >
                逐步練習
                <br />
                <small>聽一步，做一步</small>
              </button>
              <button
                className={`option ${mode === "complete" ? "selected" : ""}`}
                aria-pressed={mode === "complete"}
                onClick={() => setMode("complete")}
              >
                整段挑戰
                <br />
                <small>聽完全部，再依序做</small>
              </button>
            </div>
          </>
        )}
        {game === "grid" && (
          <div className="direction-practice">
            <h2>先認識方向</h2>
            <p>畫面的上方是上，左邊是左。</p>
            <div className="direction-options">
              {(difficulty >= 2 ? ALL_DIRS : AXES).map((d) => (
                <button
                  key={d}
                  className={`chip ${dir === d ? "selected" : ""}`}
                  onClick={() => setDir(d)}
                >
                  {DIRECTIONS[d].arrow} {DIRECTIONS[d].label}
                </button>
              ))}
            </div>
            <div className="direction-demo">
              <span className={`direction-arrow ${dir}`} aria-hidden="true">
                {DIRECTIONS[dir].arrow}
              </span>
              <Bunny small />
            </div>
            <Button
              secondary
              disabled={dirPlaying}
              onClick={async () => {
                setDirPlaying(true);
                try {
                  await audio.play(["symbols/s01", `voice/dir-${dir}`]);
                } catch {
                } finally {
                  setDirPlaying(false);
                }
              }}
            >
              ♪ 聽方向
            </Button>
          </div>
        )}
      </section>
      <div className="note">
        已認識 {progress.introduced.length} 個注音。
        {game === "match"
          ? "選項不足時會使用較少選項，題目只使用已認識的注音。"
          : `這個難度需要先認識 ${min} 個注音。`}
      </div>
      {enough ? (
        <Button onClick={() => void begin(game, difficulty, mode, steps)}>
          開始小冒險 →
        </Button>
      ) : (
        <>
          <p className="warning">
            先認識 {min - progress.introduced.length} 個注音，就可以開始。
          </p>
          <Button onClick={() => navigate("/explore")}>先去認識注音</Button>
        </>
      )}
      <p className="muted centered">
        每回合 {progress.roundQuestions}{" "}
        題，沒有倒數計時。題數可在家長專區設定。答對後會自動進入下一題，完成最後一題會自動領取貼紙。
      </p>
    </>
  );
}

interface RoundProps {
  config: {
    game: Game;
    difficulty: number;
    mode: "guided" | "complete";
    steps: number;
    questionCount: RoundQuestionCount;
  };
  pool: string[];
  results: Progress["results"];
  update: (f: (p: Progress) => Progress) => void;
  onDone: () => void;
}
function Round({ config, pool, results, update, onDone }: RoundProps) {
  const recentTargets = useRef<string[]>([]);
  function newQuestion() {
    const counts = new Map(
      pool.map((id) => [
        id,
        results.filter(
          (r) =>
            r.game === "match" && r.target === id && r.kind !== "interrupted",
        ).length,
      ]),
    );
    const candidates = pool.filter(
      (id) => !recentTargets.current.slice(-2).includes(id),
    );
    const least = Math.min(...candidates.map((id) => counts.get(id) || 0));
    const eligible = candidates.filter((id) => (counts.get(id) || 0) === least);
    const preferred =
      config.game === "match"
        ? eligible[Math.floor(Math.random() * eligible.length)]
        : undefined;
    const question = makeQuestion(
      config.game,
      pool,
      config.difficulty,
      crypto.getRandomValues(new Uint32Array(1))[0],
      config.mode,
      config.steps,
      undefined,
      preferred,
    );
    recentTargets.current.push(question.target);
    return question;
  }
  const roundId = useRef(crypto.randomUUID()).current;
  const [questionNumber, setQuestionNumber] = useState(0);
  const [q, setQ] = useState(newQuestion);
  const [run, dispatch] = useReducer(runReducer, undefined, initialRun);
  const [summary, setSummary] = useState<ResultKind[]>([]);
  const [finished, setFinished] = useState(false);
  const finishedRef = useRef(finished);
  finishedRef.current = finished;
  const [completionPaused, setCompletionPaused] = useState(false);
  const [exit, setExit] = useState(false);
  const [textVisible, setTextVisible] = useState(false);
  const recorded = useRef(new Set<string>());
  const advanced = useRef(new Set<string>());
  const last = useRef({ q, run });
  last.current = { q, run };
  const playLock = useRef(false);
  const isGuided = config.game === "command" && config.mode === "guided";
  const record = useCallback(
    (question: Question, state: RunState, kind: ResultKind) => {
      if (recorded.current.has(question.id)) return;
      recorded.current.add(question.id);
      update((p) => recordResult(p, question, state, kind, roundId));
      setSummary((s) => [...s, kind]);
    },
    [update, roundId],
  );
  async function listen(replay = false) {
    if (playLock.current) return;
    playLock.current = true;
    dispatch({ type: "listen", replay });
    try {
      const clips = isGuided ? q.stepClips[run.step] : q.clips;
      const ok = await audio.play(clips);
      if (ok) dispatch({ type: "ready" });
    } catch {
      dispatch({ type: "error" });
    } finally {
      playLock.current = false;
    }
  }
  useEffect(() => {
    update((p) =>
      recordResult(
        p,
        q,
        { ...initialRun(), interrupted: true },
        "interrupted",
        roundId,
      ),
    );
  }, [q.id, update, roundId]);
  useEffect(() => {
    if (run.phase === "loading" && !finished) void listen();
  }, [run.phase, q.id, run.step, finished]);
  useEffect(() => {
    if (run.phase !== "feedback") return;
    const correct = run.reason === "correct";
    let canceled = false;
    let timer: ReturnType<typeof setTimeout>;
    const started = performance.now();
    void audio
      .play([correct ? "voice/correct" : "voice/retry"])
      .then((ok) => {
        if (canceled || !ok) return;
        timer = setTimeout(
          () => {
            dispatch({
              type: "feedbackDone",
              correct,
              guided: isGuided,
              length: q.steps.length,
            });
            if (!correct && run.mistakes >= 3)
              dispatch({ type: "hint", level: 3 });
          },
          Math.max(0, 500 - (performance.now() - started)),
        );
      })
      .catch(() => {
        if (!canceled) dispatch({ type: "error" });
      });
    return () => {
      canceled = true;
      clearTimeout(timer);
    };
  }, [run.phase, run.reason, run.mistakes, isGuided, q.steps.length]);
  useEffect(() => {
    if (run.phase === "completed") record(q, run, classify(run));
  }, [run.phase, q, run, record]);
  useAutoAdvance(
    run.phase === "completed" && !finished && !exit && !completionPaused,
    q.id,
    next,
    () => setCompletionPaused(true),
  );
  useEffect(() => {
    const pause = () => {
      if (
        document.hidden &&
        !finishedRef.current &&
        last.current.run.phase !== "completed"
      ) {
        audio.stop();
        dispatch({ type: "pause" });
      }
    };
    document.addEventListener("visibilitychange", pause);
    const exit = () => {
      const { q, run } = last.current;
      if (!recorded.current.has(q.id)) {
        update((p) =>
          recordResult(
            p,
            q,
            { ...run, interrupted: true },
            "interrupted",
            roundId,
          ),
        );
      }
    };
    window.addEventListener("pagehide", exit);
    return () => {
      audio.stop();
      document.removeEventListener("visibilitychange", pause);
      window.removeEventListener("pagehide", exit);
      const { q, run } = last.current;
      if (!recorded.current.has(q.id))
        update((p) =>
          recordResult(
            p,
            q,
            { ...run, interrupted: true },
            "interrupted",
            roundId,
          ),
        );
    };
  }, [update, roundId]);
  function next() {
    if (advanced.current.has(q.id)) return;
    advanced.current.add(q.id);
    audio.stop();
    if (questionNumber === config.questionCount - 1) {
      setFinished(true);
      update((p) =>
        p.rounds.includes(roundId)
          ? p
          : { ...p, rounds: [...p.rounds, roundId], stickers: p.stickers + 1 },
      );
      void audio.play(["voice/done"]).catch(() => {});
    } else {
      setQuestionNumber((n) => n + 1);
      setQ(newQuestion());
      dispatch({ type: "reset" });
      setTextVisible(false);
    }
  }
  function skip() {
    audio.stop();
    record(q, run, classify(run, true));
    next();
  }
  function hint() {
    const level = Math.min(3, run.hint + 1);
    dispatch({ type: "hint", level });
    if (level === 1 && config.game === "match") void listen(true);
    if (level >= 3)
      void audio
        .play([`symbols/${q.board[q.steps[run.step].target]}`])
        .catch(() => {});
  }
  function leave() {
    audio.stop();
    record(q, { ...run, interrupted: true }, "interrupted");
    onDone();
  }
  const step = q.steps[Math.min(run.step, q.steps.length - 1)];
  const disabled = run.phase !== "answering";
  if (finished)
    return (
      <>
        <Header title="小冒險完成！" onBack={onDone} />
        <section className="round-result">
          <Bunny />
          <div className="sticker">✿</div>
          <h2>送你一朵小花！</h2>
          <p>你完成了今天的冒險。</p>
          <div className="result-list">
            {summary.map((kind, i) => (
              <div key={i}>
                <span>第 {i + 1} 題</span>
                <strong>{KIND[kind]}</strong>
              </div>
            ))}
          </div>
          <p className="muted">看看遠方、動動身體，再玩下一回。</p>
          <Button onClick={onDone}>回遊戲選單</Button>
          <Button
            secondary
            onClick={() => {
              void audio.play(["voice/break"]).catch(() => {});
            }}
          >
            ♪ 聽小兔說話
          </Button>
        </section>
      </>
    );
  return (
    <>
      <Header
        title={GAMES[config.game].title}
        onBack={() => {
          audio.stop();
          dispatch({ type: "pause" });
          setExit(true);
        }}
      />
      <div className="round-meta">
        <span>
          第 {questionNumber + 1} / {config.questionCount} 題
        </span>
        <progress
          className="round-progress"
          aria-label={`已完成 ${questionNumber} / ${config.questionCount} 題`}
          value={questionNumber}
          max={config.questionCount}
        />
        <button
          className="text-button"
          onClick={() => {
            audio.stop();
            if (run.phase === "completed") setCompletionPaused(true);
            dispatch({ type: "pause" });
          }}
        >
          暫停
        </button>
      </div>
      <section className="instruction">
        <span className="sound-badge" aria-hidden="true">
          ♪
        </span>
        <div>
          <h2>
            {run.phase === "listening"
              ? "小耳朵，仔細聽…"
              : run.phase === "completed"
                ? "找到了！"
                : run.hint >= 3
                  ? "一起練習這一題"
                  : config.game === "match"
                    ? "點你聽到的注音"
                    : config.game === "command"
                      ? isGuided
                        ? `第 ${run.step + 1} 步`
                        : "照剛才的順序點"
                      : "找到指定的那一格"}
          </h2>
          <p role="status" aria-live="polite">
            {run.phase === "listening"
              ? "聲音說完後，就可以點。"
              : run.phase === "feedback"
                ? run.reason === "correct"
                  ? "✓ 找到了！"
                  : "再聽一次，慢慢找。"
                : run.phase === "completed"
                  ? KIND[classify(run)]
                  : config.game === "command"
                    ? `已完成 ${run.step} / ${q.steps.length} 步`
                    : "慢慢找，不用急。"}
          </p>
        </div>
      </section>
      {config.game === "command" && (
        <div className="step-progress" aria-label="指令進度">
          {q.steps.map((_, i) => (
            <span
              key={i}
              className={i < run.step ? "done" : i === run.step ? "active" : ""}
            >
              {i < run.step ? "✓" : i + 1}
            </span>
          ))}
        </div>
      )}
      <div className={`board cols-${q.cols}`} aria-label="注音選項">
        {q.board.map((id, i) => {
          const feedback =
            run.feedback === i
              ? run.reason === "correct"
                ? "correct"
                : "retry"
              : "";
          const targetHint = run.hint >= 2 && i === step.target;
          const refHint = run.hint === 1 && i === step.ref;
          const previously =
            run.step > 0 &&
            q.steps.slice(0, run.step).some((s) => s.target === i);
          return (
            <button
              key={id}
              aria-label={`${symbol(id).glyph}${previously ? "，已點過" : ""}`}
              disabled={disabled}
              className={`symbol-card ${feedback} ${targetHint ? "hinted" : ""} ${refHint ? "reference" : ""} ${previously ? "previous" : ""}`}
              onClick={() =>
                dispatch({
                  type: "choose",
                  index: i,
                  event: crypto.randomUUID(),
                  expected: step.target,
                  length: q.steps.length,
                  guided: isGuided,
                })
              }
            >
              <Glyph id={id} />
              {feedback === "correct" || previously ? (
                <span className="card-mark" aria-hidden="true">
                  ✓
                </span>
              ) : feedback === "retry" ? (
                <span className="card-mark" aria-hidden="true">
                  再找找
                </span>
              ) : targetHint ? (
                <span className="card-mark">一起找</span>
              ) : null}
              {refHint && step.direction && (
                <span className="reference-arrow" aria-hidden="true">
                  {DIRECTIONS[step.direction].arrow}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="game-controls">
        {run.phase === "completed" ? (
          <p className="auto-next" role="status">
            {questionNumber === config.questionCount - 1
              ? "答對了！準備領小花貼紙…"
              : "答對了！正在前往下一題…"}
          </p>
        ) : (
          <>
            <Button
              secondary
              disabled={["listening", "feedback", "paused"].includes(run.phase)}
              onClick={() => void listen(true)}
            >
              ♪ {isGuided ? "再聽這一步" : "再聽一次"}
            </Button>
            <Button secondary disabled={disabled} onClick={hint}>
              小兔幫幫我
            </Button>
          </>
        )}
      </div>
      {config.game !== "match" && run.phase !== "completed" && (
        <>
          <button
            className="text-button"
            disabled={run.phase === "listening"}
            onClick={() => {
              setTextVisible((v) => !v);
              dispatch({ type: "hint", level: 1 });
            }}
          >
            看文字指令
          </button>
          {textVisible && (
            <p className="written-instruction">
              {isGuided ? stepText(step, q.board) : q.text}
            </p>
          )}
        </>
      )}
      {run.hint === 1 && step.direction && (
        <p className="hint-note">
          找框起來的注音，再往 {DIRECTIONS[step.direction].arrow}{" "}
          {DIRECTIONS[step.direction].label} 一格。
        </p>
      )}
      {run.hint >= 2 && <p className="hint-note">小兔框起來了，一起找找看。</p>}
      {run.phase !== "completed" && (
        <button
          className="text-button skip"
          onClick={skip}
          disabled={run.phase === "listening" || run.phase === "feedback"}
        >
          這題先略過
        </button>
      )}
      {(run.phase === "paused" || exit || completionPaused) && (
        <Modal title="暫停遊戲">
          <Bunny small />
          <h2>{exit ? "要回選單嗎？" : "休息一下"}</h2>
          <p>
            {run.phase === "completed"
              ? "這題已完成，繼續時會自動進入下一題。"
              : "這題會記為中斷。繼續時，重新聽完整指令。"}
          </p>
          <Button
            onClick={() => {
              void audio
                .unlock()
                .then(() => {
                  setExit(false);
                  setCompletionPaused(false);
                  if (run.phase !== "completed") dispatch({ type: "resume" });
                })
                .catch(() => {
                  setExit(false);
                  setCompletionPaused(false);
                  dispatch({ type: "error" });
                });
            }}
          >
            繼續遊戲
          </Button>
          <Button secondary onClick={leave}>
            回遊戲選單
          </Button>
        </Modal>
      )}
      {run.phase === "error" && (
        <Modal title="聲音暫時無法播放">
          <h2>聲音還沒準備好</h2>
          <p>請大人確認音量、網路與離線素材。這題不會算作答錯。</p>
          <Button
            onClick={() => {
              void audio
                .unlock()
                .then(() => dispatch({ type: "resume" }))
                .catch(() => dispatch({ type: "error" }));
            }}
          >
            再試一次
          </Button>
          <Button
            secondary
            onClick={() =>
              void audio
                .reset()
                .then(() => dispatch({ type: "resume" }))
                .catch(() => dispatch({ type: "error" }))
            }
          >
            重新啟用聲音
          </Button>
          <Button secondary onClick={leave}>
            回選單
          </Button>
        </Modal>
      )}
    </>
  );
}
function AdultGate({
  onPass,
  onClose,
}: {
  onPass: () => void;
  onClose: () => void;
}) {
  const [a] = useState(() => 7 + Math.floor(Math.random() * 5));
  const [b] = useState(() => 5 + Math.floor(Math.random() * 5));
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  return (
    <Modal title="請大人幫忙">
      <h2>請交給大人操作</h2>
      <p>
        請輸入 {a} + {b} 的答案。
      </p>
      <label className="sr-only" htmlFor="gate-answer">
        算式答案
      </label>
      <input
        id="gate-answer"
        inputMode="numeric"
        autoComplete="off"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setError(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            if (Number(value) === a + b) onPass();
            else setError(true);
          }
        }}
      />
      {error && (
        <p className="warning" role="alert">
          再確認一下答案。
        </p>
      )}
      <Button
        onClick={() => {
          if (Number(value) === a + b) onPass();
          else setError(true);
        }}
      >
        進入家長專區
      </Button>
      <Button secondary onClick={onClose}>
        回到遊戲
      </Button>
      <small>這是操作分隔，沒有身分驗證，也不蒐集個資。</small>
    </Modal>
  );
}

type ReleaseCheck = { status: "checking" | "current" | "new" | "offline"; latest?: string };
function ReleaseInfo({ progress }: { progress: Progress }) {
  const [release, setRelease] = useState<ReleaseCheck>({ status: "checking" });
  const generation = useRef(0);
  const playableWords = WORDS.filter(
    (word) =>
      progress.advancedWords.includes(word.id) &&
      word.parts.every((id) => progress.introduced.includes(id)),
  ).length;
  async function checkForUpdates() {
    const ticket = ++generation.current;
    setRelease({ status: "checking" });
    try {
      // The service worker bypasses this endpoint; always check the live published build.
      const response = await fetch(`${BASE}release.json?check=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error("release not available");
      const published: unknown = await response.json();
      if (
        typeof published !== "object" || published === null ||
        !("version" in published) || typeof published.version !== "string" ||
        !("build" in published) || typeof published.build !== "string"
      ) throw new Error("invalid release info");
      if (ticket !== generation.current) return;
      const updated = published.build !== BUILD_ID;
      setRelease({ status: updated ? "new" : "current", latest: published.version });
      if (updated && "serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.getRegistration(BASE);
        void registration?.update().catch(() => {});
      }
    } catch {
      if (ticket === generation.current) setRelease({ status: "offline" });
    }
  }
  useEffect(() => {
    void checkForUpdates();
    return () => { generation.current += 1; };
  }, []);
  return (
    <section className="summary-card" aria-label="遊戲版本與題庫資訊">
      <h2>版本與題庫資訊</h2>
      <div className="metrics">
        <div><strong>v{VERSION}</strong><span>目前使用版本</span></div>
        <div><strong>{WORDS.length}</strong><span>完整詞語題庫</span></div>
        <div><strong>{playableWords}</strong><span>本機已開放詞語</span></div>
      </div>
      <p>本機已標記 {progress.advancedWords.length} 個詞語，並已認識 {progress.introduced.length}/37 個注音；只有兩項條件都符合的詞語才可練習。</p>
      <p className="muted">發布識別：{BUILD_ID}。每回合可選 5、10、15、20、30 題。</p>
      <p role="status">
        {release.status === "checking" ? "正在連線檢查發布版本…" :
          release.status === "current" ? "✓ 已是最新版。" :
          release.status === "new" ? `有新版 v${release.latest}，可更新遊戲。` :
          "無法連線確認最新版；離線遊戲仍可繼續。"}
      </p>
      <Button secondary onClick={() => void checkForUpdates()}>重新檢查更新</Button>
      {release.status === "new" && (
        <Button onClick={() => void applyUpdate()}>更新樂園</Button>
      )}
    </section>
  );
}
function Parent({
  progress,
  update,
  offline,
  storageError,
  onClear,
}: {
  progress: Progress;
  update: (f: (p: Progress) => Progress) => void;
  offline: OfflineState;
  storageError: boolean;
  onClear: () => Promise<void>;
}) {
  const [tab, setTab] = useState<"progress" | "settings" | "about">("progress");
  const [confirm, setConfirm] = useState(false);
  const [exportError, setExportError] = useState(false);
  const summary = stats(progress.results.filter((r) => r.game === "match"));
  function exportData() {
    try {
      const blob = new Blob(
        [
          JSON.stringify(
            {
              version: VERSION,
              exportedAt: new Date().toISOString(),
              progress,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "注音樂園_本機進度.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setExportError(true);
    }
  }
  return (
    <>
      <Header title="家長專區" back="/" />
      <div className="tabs">
        {(["progress", "settings", "about"] as const).map((t) => (
          <button
            key={t}
            aria-pressed={tab === t}
            className={tab === t ? "selected" : ""}
            onClick={() => setTab(t)}
          >
            {
              {
                progress: "學習紀錄",
                settings: "陪玩設定",
                about: "關於與隱私",
              }[t]
            }
          </button>
        ))}
      </div>
      {tab === "progress" ? (
        <>
          <section className="summary-card">
            <h2>本裝置的學習足跡</h2>
            <div className="metrics">
              <div>
                <strong>{progress.introduced.length}/37</strong>
                <span>已引入的注音</span>
              </div>
              <div>
                <strong>{progress.stickers}</strong>
                <span>完成回合貼紙</span>
              </div>
            </div>
            <p>
              聽音找注音：
              {summary.percent === null
                ? "還沒有有效作答"
                : `獨立完成 ${summary.independent} / ${summary.effective} 題（${summary.percent}%）`}
            </p>
            <small>有效作答包含重聽、協助、教學及略過；排除中斷。</small>
          </section>
          <section>
            <h2>37 個注音</h2>
            <div className="parent-symbols">
              {SYMBOLS.map((s) => {
                const rs = progress.results.filter(
                  (r) => r.game === "match" && r.target === s.id,
                );
                const x = stats(rs);
                return (
                  <div
                    key={s.id}
                    className={
                      progress.introduced.includes(s.id) ? "introduced" : ""
                    }
                  >
                    <Glyph id={s.id} />
                    <span>
                      {progress.introduced.includes(s.id) ? "已引入" : "未引入"}
                    </span>
                    <small>
                      {x.effective
                        ? `${x.independent}/${x.effective} 獨立`
                        : "尚無聽辨紀錄"}
                    </small>
                  </div>
                );
              })}
            </div>
          </section>
          <section>
            <h2>各模式的紀錄</h2>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>遊戲／難度／模式</th>
                    <th>有效題數</th>
                    <th>獨立完成</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from(
                    new Set(
                      progress.results.map(
                        (r) => `${r.game}|${r.difficulty}|${r.mode}|${r.steps}`,
                      ),
                    ),
                  ).map((key) => {
                    const [game, d, mode, steps] = key.split("|");
                    const s = stats(
                      progress.results.filter(
                        (r) =>
                          `${r.game}|${r.difficulty}|${r.mode}|${r.steps}` ===
                          key,
                      ),
                    );
                    return (
                      <tr key={key}>
                        <td>
                          {ALL_GAMES[game as keyof typeof ALL_GAMES].title}
                          <br />
                          <small>
                            難度 {Number(d) + 1}・
                            {mode === "guided" ? "逐步" : "整段"}・{steps} 步
                          </small>
                        </td>
                        <td>{s.effective}</td>
                        <td>
                          {s.independent}
                          {s.percent !== null ? `（${s.percent}%）` : ""}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!progress.results.length && (
              <p>開始一回合遊戲後，這裡就會出現紀錄。</p>
            )}
          </section>
          <section>
            <h2>最近 20 題</h2>
            <div className="result-list">
              {progress.results
                .slice(-20)
                .reverse()
                .map((r) => (
                  <div key={r.id}>
                    <span>{ALL_GAMES[r.game].title}</span>
                    <strong>{KIND[r.kind]}</strong>
                  </div>
                ))}
            </div>
          </section>
          <section>
            <h2>進階冒險的學習紀錄</h2>
            <div className="advanced-stats">
              {(Object.keys(ADVANCED_GAMES) as AdvancedGame[]).map((game) => {
                const s = stats(
                  progress.results.filter((r) => r.game === game),
                );
                return (
                  <div key={game}>
                    <strong>{ADVANCED_GAMES[game].title}</strong>
                    <span>
                      {s.effective
                        ? `獨立 ${s.independent} / ${s.effective} 題`
                        : "尚無有效作答"}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="muted">
              各能力分開記錄；翻翻樂一題代表整組配對。看答案提示、讀出小商店訂單、重聽與暫停重做，均不列為獨立完成。
            </p>
          </section>
          <div className="note">
            這些紀錄供陪玩參考，不是能力診斷。發音僅跟讀，未使用語音辨識，也不提供發音分數。形狀配對和指令遊戲不會混入逐符號聽辨分數。最多保留最近
            1,000 題。
          </div>
        </>
      ) : tab === "settings" ? (
        <>
          <section aria-labelledby="round-questions-title">
            <h2 id="round-questions-title">每回合題目數</h2>
            <p>
              適用於全部九款作答遊戲；翻翻樂一題是一組配對。認識注音可自由探索。
            </p>
            <div className="option-grid" role="group" aria-label="每回合題目數">
              {ROUND_QUESTION_OPTIONS.map((count) => (
                <button
                  key={count}
                  className={`option ${progress.roundQuestions === count ? "selected" : ""}`}
                  aria-pressed={progress.roundQuestions === count}
                  onClick={() =>
                    update((p) => ({ ...p, roundQuestions: count }))
                  }
                >
                  {count} 題
                </button>
              ))}
            </div>
            <p className="muted" role="status">
              目前每回合 {progress.roundQuestions}{" "}
              題；設定保留在本裝置，從下一回合生效。
            </p>
            <small>
              建議先從短回合開始，依孩子的精神與興趣增加。隨時可以暫停休息；完成一回合仍獲得一張小花貼紙。
            </small>
          </section>
          <section>
            <h2>設定孩子已認識的注音</h2>
            <p>
              只勾選您確認孩子已學過的符號。這會開放題庫，不代表已通過聽辨測驗。
            </p>
            <div className="selection-grid">
              {SYMBOLS.map((s) => (
                <button
                  key={s.id}
                  aria-label={`${s.glyph}，${progress.introduced.includes(s.id) ? "取消已認識" : "標為已認識"}`}
                  aria-pressed={progress.introduced.includes(s.id)}
                  className={`symbol-card ${progress.introduced.includes(s.id) ? "introduced" : ""}`}
                  onClick={() =>
                    update((p) => ({
                      ...p,
                      introduced: p.introduced.includes(s.id)
                        ? p.introduced.filter((i) => i !== s.id)
                        : [...p.introduced, s.id],
                    }))
                  }
                >
                  <Glyph id={s.id} />
                  <span>{progress.introduced.includes(s.id) ? "✓" : "＋"}</span>
                </button>
              ))}
            </div>
            <Button
              secondary
              onClick={() =>
                update((p) => ({ ...p, introduced: SYMBOLS.map((s) => s.id) }))
              }
            >
              我已確認：37 個都學過
            </Button>
          </section>
          <section>
            <h2>進階題庫：確認已學過的內容</h2>
            <p>
              只勾選您確認孩子已學過的詞語與聲調。遊戲仍會檢查其中注音是否已引入；這些勾選不是測驗成績。
            </p>
            <div className="parent-word-options">
              {WORDS.map((w) => (
                <button
                  key={w.id}
                  className={`option ${progress.advancedWords.includes(w.id) ? "selected" : ""}`}
                  aria-pressed={progress.advancedWords.includes(w.id)}
                  onClick={() =>
                    update((p) => ({
                      ...p,
                      advancedWords: p.advancedWords.includes(w.id)
                        ? p.advancedWords.filter((id) => id !== w.id)
                        : [...p.advancedWords, w.id],
                    }))
                  }
                >
                  {w.text}
                  <small>{wordNotation(w)}</small>
                </button>
              ))}
            </div>
            <Button
              secondary
              onClick={() =>
                update((p) => ({ ...p, advancedWords: WORDS.map((w) => w.id) }))
              }
            >
              我已確認：{WORDS.length} 個詞語都學過
            </Button>
            <div className="option-grid tone-settings">
              {TONES.map((t) => (
                <button
                  key={t.id}
                  className={`option ${progress.introducedTones.includes(t.id) ? "selected" : ""}`}
                  aria-pressed={progress.introducedTones.includes(t.id)}
                  onClick={() =>
                    update((p) => ({
                      ...p,
                      introducedTones: p.introducedTones.includes(t.id)
                        ? p.introducedTones.filter((id) => id !== t.id)
                        : [...p.introducedTones, t.id],
                    }))
                  }
                >
                  {t.label}
                </button>
              ))}
            </div>
            <Button
              secondary
              onClick={() =>
                update((p) => ({
                  ...p,
                  introducedTones: TONES.map((t) => t.id),
                }))
              }
            >
              我已確認：四聲與輕聲都學過
            </Button>
          </section>
          <section>
            <h2>聲音與離線</h2>
            <p>
              {offline.ready
                ? "✓ 全部遊戲素材已完成驗證，可離線使用。"
                : "離線素材正在準備，完成前請保持網路連線。"}
            </p>
            {offline.error && <p className="warning">{offline.error}</p>}
            <AudioControls
              label="♪ 測試注音與指令聲音"
              clips={["symbols/s01", "voice/direction-help"]}
            />
            <p>
              iPhone／iPad：先點喇叭或「重新啟用聲音」，再提高媒體音量並檢查藍牙或耳機輸出。若仍聽不到，關閉這個分頁，用
              Safari 新分頁重新開啟。舊版 Safari 可能仍需關閉靜音模式。Safari
              可從分享選單「加入主畫面」；Android Chrome
              可從選單安裝。第一次完整開啟並顯示「離線素材已準備好」後，再離線使用。
            </p>
            {offline.update && (
              <Button onClick={() => void applyUpdate()}>
                安裝已下載的新版
              </Button>
            )}
          </section>
          <section>
            <h2>資料管理</h2>
            <p>
              紀錄只存於這個瀏覽器；清除網站資料、換裝置或無痕模式，可能無法保留。
            </p>
            <Button secondary onClick={exportData}>
              匯出本機紀錄
            </Button>
            {exportError && <p>此瀏覽器無法下載，請換其他瀏覽器匯出。</p>}
            <Button
              secondary
              className="danger"
              onClick={() => setConfirm(true)}
            >
              清除全部學習紀錄
            </Button>
          </section>
        </>
      ) : (
        <>
          <ReleaseInfo progress={progress} />
          <section>
            <h2>親子試玩版 v{VERSION}</h2>
            <p>
              十款遊戲可實際作答，涵蓋全部 37
              個注音及進階拼音、聲調、詞語與記憶。此版供家長陪玩與驗證；37
              音檔逐符號雙人聽校、真機測試及幼兒可用性測試仍待完成。
            </p>
            <p>
              建議每次 3–5
              分鐘。難度依孩子的熟悉程度選擇；沒有倒數、排行榜或連續登入壓力。
            </p>
          </section>
          <section>
            <h2>隱私承諾</h2>
            <p>
              不要求姓名、生日、帳號；不使用麥克風、相機、定位、廣告或追蹤分析。匿名學習紀錄存於裝置
              IndexedDB，不上傳。
            </p>
            <p>
              網站由 GitHub Pages
              提供，連線時會向網站主機取得網頁與素材，主機可能保留一般連線紀錄（例如
              IP 位址）。匯出紀錄由您自行保管。
            </p>
            <p>
              {storageError ? "目前瀏覽器無法儲存。" : "目前本機儲存正常。"}
              遊戲不會在背景呼叫外部語音服務。
            </p>
          </section>
          <section>
            <h2>素材出處與校對</h2>
            <p>2017 © 教育部，國語注音符號手冊-開放部件。</p>
            <p>
              此素材依「創用CC 姓名標示 4.0
              國際版本」授權條款進行公眾釋出，使用者於遵守本條款各項規定之前提下，得利用之。
            </p>
            <p>
              37 個符號字形取自筆畫資料並合併為 SVG；37 個符號讀音取自官方
              F1–F37 WAV，轉為單聲道 MP3。未以文字轉語音替代符號讀音。
            </p>
            <p>
              <a
                href="https://language.moe.gov.tw/001/Upload/files/site_content/M0001/juyin/index.htm"
                target="_blank"
                rel="noreferrer"
              >
                教育部國語注音符號手冊
              </a>{" "}
              ·{" "}
              <a
                href="https://creativecommons.org/licenses/by/4.0/deed.zh_TW"
                target="_blank"
                rel="noreferrer"
              >
                CC BY 4.0
              </a>
            </p>
            <p>
              引導、方位及回饋語音使用臺灣華語合成語音（zh-TW-HsiaoChenNeural），預先製成音檔；與教育部素材分開標示，仍待人工聽校。小兔及介面圖形為本專案原創。
            </p>
            <p>
              進階遊戲使用固定的 {WORDS.length}
              個生活詞語、四聲對比與詞語末音題庫；完整讀音為預製臺灣華語合成音，不將單符號錄音拼接成音節。聲調依教育部標注規則呈現；
              {WORDS.length}
              張詞語圖卡為本專案原創
              SVG。完整音節、輕聲與連續語流仍需臺灣華語教學者雙人聽校。
            </p>
            <p>
              發現讀音或方位問題時，請先停止該模式並告知維護者。這裡沒有自動傳送或聯絡表單。
            </p>
          </section>
        </>
      )}
      {confirm && (
        <Modal title="清除學習紀錄">
          <h2>確定清除全部紀錄？</h2>
          <p>
            將清除本裝置的注音、詞語與聲調引入、作答紀錄與貼紙，題數設定恢復為每回合
            5 題。建議先匯出；這個操作無法復原。
          </p>
          <Button secondary onClick={() => setConfirm(false)}>
            保留紀錄
          </Button>
          <Button
            className="danger"
            onClick={async () => {
              await onClear();
              setConfirm(false);
            }}
          >
            確定清除
          </Button>
        </Modal>
      )}
    </>
  );
}
