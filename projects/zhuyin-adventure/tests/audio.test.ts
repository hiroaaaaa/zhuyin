import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { AudioPlayer } from "../src/core/audio";
class Source {
  buffer: AudioBuffer | null = null;
  onended: (() => void) | null = null;
  connect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
  end() {
    this.onended?.();
  }
}
class Context extends EventTarget {
  static instances: Context[] = [];
  static resumeWait: Promise<void> | null = null;
  static sessionAtCreation: string | undefined;
  state = "suspended";
  destination = {};
  sources: Source[] = [];
  constructor() {
    super();
    Context.instances.push(this);
    Context.sessionAtCreation = (navigator as any).audioSession?.type;
  }
  resume = vi.fn(async () => {
    if (Context.resumeWait) await Context.resumeWait;
    this.state = "running";
  });
  close = vi.fn(async () => {
    this.state = "closed";
  });
  decodeAudioData = vi.fn(async () => ({ duration: 0.25 }));
  createBufferSource() {
    const source = new Source();
    this.sources.push(source);
    return source;
  }
}
const settle = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};
let player: AudioPlayer;
beforeEach(() => {
  vi.useFakeTimers();
  Context.instances = [];
  Context.resumeWait = null;
  vi.stubGlobal("navigator", { audioSession: { type: "auto" } });
  vi.stubGlobal("AudioContext", Context);
  player = new AudioPlayer();
  player.cache.set("a", { duration: 0.25 } as AudioBuffer);
  player.cache.set("b", { duration: 0.25 } as AudioBuffer);
});
afterEach(() => {
  player.stop();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe("iPhone 語音播放與中斷恢復", () => {
  it("先設定媒體播放類別才建立 AudioContext，實際音檔結束才回傳成功", async () => {
    const p = player.play(["a", "b"]);
    await settle();
    expect(Context.sessionAtCreation).toBe("playback");
    const ctx = Context.instances[0];
    expect(ctx.sources).toHaveLength(1);
    ctx.sources[0].end();
    await settle();
    expect(ctx.sources).toHaveLength(2);
    ctx.sources[1].end();
    expect(await p).toBe(true);
  });
  it("沒有 Audio Session API 仍可播音", async () => {
    vi.stubGlobal("navigator", {});
    const p = player.play(["a"]);
    await settle();
    Context.instances[0].sources[0].end();
    expect(await p).toBe(true);
  });
  it("停止不依賴 Safari 的 onended，立即結束並回傳未播完", async () => {
    const p = player.play(["a"]);
    await settle();
    const source = Context.instances[0].sources[0];
    player.stop();
    expect(await p).toBe(false);
    expect(source.stop).toHaveBeenCalled();
    expect(source.onended).toBeNull();
  });
  it("await resume 期間取消，不能復活舊音檔", async () => {
    let release!: () => void;
    Context.resumeWait = new Promise<void>((resolve) => {
      release = resolve;
    });
    const p = player.play(["a"]);
    await settle();
    player.stop();
    release();
    expect(await p).toBe(false);
    expect(Context.instances[0].sources).toHaveLength(0);
  });
  it("切換到新播放會取消舊播放，不能互相套用完成事件", async () => {
    const first = player.play(["a"]);
    await settle();
    const second = player.play(["b"]);
    await settle();
    expect(await first).toBe(false);
    Context.instances[0].sources[1].end();
    expect(await second).toBe(true);
  });
  it("AudioContext 中斷會回報錯誤，不讓遊戲永遠等候", async () => {
    const p = player.play(["a"]);
    const check = expect(p).rejects.toThrow("重新啟用聲音");
    await settle();
    const ctx = Context.instances[0];
    ctx.state = "interrupted";
    ctx.dispatchEvent(new Event("statechange"));
    await check;
  });
  it("Safari 的 resume Promise 不結束時有四秒上限", async () => {
    Context.resumeWait = new Promise(() => {});
    const p = player.play(["a"]);
    const check = expect(p).rejects.toThrow("重新啟用聲音");
    await vi.advanceTimersByTimeAsync(4001);
    await check;
  });
  it("音檔沒有 ended 事件時會回報逾時，可重新啟用並用新 context 播放", async () => {
    const p = player.play(["a"]);
    const check = expect(p).rejects.toThrow("重新啟用聲音");
    await settle();
    await vi.advanceTimersByTimeAsync(4251);
    await check;
    await player.reset();
    expect(Context.instances).toHaveLength(2);
    expect(Context.instances[0].close).toHaveBeenCalled();
    const recovered = player.play(["a"]);
    await settle();
    Context.instances[1].sources[0].end();
    expect(await recovered).toBe(true);
  });
});
