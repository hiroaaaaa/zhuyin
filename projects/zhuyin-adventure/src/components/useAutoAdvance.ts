import { useEffect, useRef } from "react";

// 回饋語音結束後才啟用；保留短暫成功畫面，離開畫面則等孩子回來繼續。
export function useAutoAdvance(
  enabled: boolean,
  questionId: string,
  next: () => void,
  pause: () => void,
) {
  const callbacks = useRef({ enabled, questionId, next, pause });
  callbacks.current = { enabled, questionId, next, pause };
  useEffect(() => {
    if (!enabled) return;
    let canceled = false;
    const current = () =>
      callbacks.current.enabled && callbacks.current.questionId === questionId;
    const hold = () => {
      if (canceled || !current()) return;
      canceled = true;
      clearTimeout(timer);
      callbacks.current.pause();
    };
    const visibility = () => {
      if (document.hidden) hold();
    };
    const timer = setTimeout(() => {
      if (canceled || !current()) return;
      if (document.hidden) return hold();
      canceled = true;
      callbacks.current.next();
    }, 650);
    window.addEventListener("blur", hold);
    document.addEventListener("visibilitychange", visibility);
    if (document.hidden) hold();
    return () => {
      canceled = true;
      clearTimeout(timer);
      window.removeEventListener("blur", hold);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [enabled, questionId]);
}
