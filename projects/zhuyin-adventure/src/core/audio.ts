import { WORDS } from "../data/advanced";
const BASE = import.meta.env.BASE_URL;
const RESUME_TIMEOUT = 4000;
const AUDIO_ERROR = "聲音未能啟動，請點「重新啟用聲音」後再試。";
class AudioPlaybackError extends Error {}
async function bounded<T>(promise: Promise<T>, ms: number, message: string) {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new AudioPlaybackError(message)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer!);
  }
}
export class AudioPlayer {
  context: AudioContext | null = null;
  source: AudioBufferSourceNode | null = null;
  token = 0;
  cache = new Map<string, AudioBuffer>();
  private cancelEnd: (() => void) | null = null;
  private fetching: AbortController | null = null;
  private cancelSpeech: (() => void) | null = null;
  constructor() {
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) this.stop();
      });
      window.addEventListener("pagehide", () => this.stop());
    }
  }
  async unlock() {
    // iOS Safari 的預設 ambient 音訊可能受靜音開關影響；語音使用媒體播放類別。
    try {
      const session = (
        navigator as Navigator & { audioSession?: { type: string } }
      ).audioSession;
      if (session) session.type = "playback";
    } catch {
      /* 不支援此 API 的瀏覽器維持一般 Web Audio 播放。 */
    }
    if (!this.context || this.context.state === "closed")
      this.context = new AudioContext();
    const ctx = this.context;
    try {
      if (ctx.state !== "running")
        await bounded(ctx.resume(), RESUME_TIMEOUT, AUDIO_ERROR);
    } catch {
      throw new AudioPlaybackError(AUDIO_ERROR);
    }
    if (ctx.state !== "running") throw new AudioPlaybackError(AUDIO_ERROR);
  }
  async reset() {
    this.stop();
    const previous = this.context;
    this.context = null;
    if (previous && previous.state !== "closed")
      void previous.close().catch(() => {});
    // 由使用者點擊時同步建立新 context，不等 close()，保留 Safari 的使用者手勢。
    await this.unlock();
  }
  stop() {
    this.token++;
    this.cancelSpeech?.();
    this.cancelSpeech = null;
    this.fetching?.abort();
    this.fetching = null;
    this.cancelEnd?.();
    this.cancelEnd = null;
    try {
      this.source?.stop();
    } catch {
      /* already ended */
    }
    this.source = null;
  }
  /** Device-local speech for extra WORDS, never used to pronounce bare ㄅㄆㄇ symbols. */
  private speakWord(text: string): Promise<void> {
    if (typeof window === "undefined" || !window.speechSynthesis ||
        typeof SpeechSynthesisUtterance === "undefined")
      return Promise.reject(new AudioPlaybackError("此裝置未提供中文語音，請使用已安裝繁體中文語音的瀏覽器。"));
    const synth = window.speechSynthesis;
    return new Promise<void>((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "zh-TW";
      utterance.rate = 0.85;
      const voices = synth.getVoices();
      const taiwan = voices.find((v) => v.lang.toLowerCase().replace("_", "-") === "zh-tw");
      if (taiwan) utterance.voice = taiwan;
      let done = false;
      const timer = setTimeout(() => finish(new AudioPlaybackError("語音逾時，請確認已安裝繁體中文語音。")), 15000);
      const finish = (err?: Error) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        utterance.onend = null;
        utterance.onerror = null;
        this.cancelSpeech = null;
        err ? reject(err) : resolve();
      };
      this.cancelSpeech = () => { synth.cancel(); finish(); };
      utterance.onend = () => finish();
      utterance.onerror = () => finish(new AudioPlaybackError("無法播放繁體中文語音，請檢查裝置的語音設定。"));
      try { synth.cancel(); synth.speak(utterance); }
      catch { finish(new AudioPlaybackError("此裝置無法啟動中文朗讀。")); }
    });
  }
  async play(clips: string[]) {
    this.stop();
    const token = this.token;
    try {
      await this.unlock();
      if (token !== this.token) return false;
      const ctx = this.context!;
      for (const id of clips) {
        if (token !== this.token) return false;
        const wordId = id.startsWith("advanced/word-") ? id.slice(14) : null;
        const extraWord = wordId ? WORDS.find((w) => w.id === wordId && w.emoji) : null;
        if (extraWord) {
          await this.speakWord(extraWord.text);
          if (token !== this.token) return false;
          continue;
        }
        let buffer = this.cache.get(id);
        if (!buffer) {
          const controller = new AbortController();
          this.fetching = controller;
          const timer = setTimeout(() => controller.abort(), 15000);
          try {
            const response = await fetch(`${BASE}audio/${id}.mp3`, {
              signal: controller.signal,
            });
            if (!response.ok)
              throw new AudioPlaybackError("音檔尚未下載完成，請連線後再試。");
            buffer = await bounded(
              ctx.decodeAudioData(await response.arrayBuffer()),
              15000,
              "音檔未能讀取，請連線後再試。",
            );
            this.cache.set(id, buffer);
          } finally {
            clearTimeout(timer);
            if (this.fetching === controller) this.fetching = null;
          }
        }
        if (token !== this.token) return false;
        if (ctx.state !== "running") throw new AudioPlaybackError(AUDIO_ERROR);
        await new Promise<void>((resolve, reject) => {
          const source = ctx.createBufferSource();
          this.source = source;
          source.buffer = buffer!;
          source.connect(ctx.destination);
          let settled = false;
          const finish = (error?: Error) => {
            if (settled) return;
            settled = true;
            clearTimeout(watchdog);
            ctx.removeEventListener("statechange", stateChanged);
            source.onended = null;
            if (this.source === source) {
              this.source = null;
              this.cancelEnd = null;
            }
            if (error) {
              try {
                source.stop();
              } catch {
                /* already ended */
              }
              reject(error);
            } else resolve();
          };
          const stateChanged = () => {
            if (ctx.state !== "running")
              finish(new AudioPlaybackError(AUDIO_ERROR));
          };
          const watchdog = setTimeout(
            () => finish(new AudioPlaybackError(AUDIO_ERROR)),
            (buffer!.duration + 4) * 1000,
          );
          this.cancelEnd = () => {
            finish();
            try {
              source.stop();
            } catch {
              /* already ended */
            }
          };
          ctx.addEventListener("statechange", stateChanged);
          source.onended = () => finish();
          try {
            source.start();
          } catch {
            finish(new AudioPlaybackError(AUDIO_ERROR));
          }
        });
        if (token !== this.token) return false;
      }
      return true;
    } catch (error) {
      if (token !== this.token) return false;
      throw error instanceof AudioPlaybackError
        ? error
        : new AudioPlaybackError("音檔未能下載或播放，請確認連線後再試。");
    }
  }
}
export const audio = new AudioPlayer();
