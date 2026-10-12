import { useEffect, useRef, useState } from "react";
import { audio } from "../core/audio";
import { Button } from "./ui";
export function AudioControls({
  label,
  clips,
}: {
  label: string;
  clips: string[];
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(false);
  const guard = useRef(false),
    live = useRef(true);
  useEffect(
    () => () => {
      live.current = false;
      if (guard.current) audio.stop();
    },
    [],
  );
  async function speak(reset = false) {
    if (guard.current) return;
    guard.current = true;
    setBusy(true);
    setError(false);
    setMessage(reset ? "正在重新啟用聲音…" : "正在播放聲音…");
    try {
      if (reset) await audio.reset();
      const ok = await audio.play(clips);
      if (live.current)
        setMessage(
          ok
            ? "播放已結束。若沒聽到，請提高媒體音量，並確認藍牙或耳機輸出。"
            : "播放已停止，可以再試一次。",
        );
    } catch (e) {
      if (live.current) {
        setError(true);
        setMessage(
          e instanceof Error
            ? e.message
            : "聲音無法播放，請重新啟用聲音後再試。",
        );
      }
    } finally {
      guard.current = false;
      if (live.current) setBusy(false);
    }
  }
  return (
    <div className="audio-tools">
      <Button secondary disabled={busy} onClick={() => void speak()}>
        {label}
      </Button>
      <button
        className="text-button"
        disabled={busy}
        onClick={() => void speak(true)}
      >
        重新啟用聲音
      </button>
      {message && (
        <p
          className={error ? "warning" : "muted"}
          role={error ? "alert" : "status"}
          data-testid="audio-result"
        >
          {message}
        </p>
      )}
    </div>
  );
}
