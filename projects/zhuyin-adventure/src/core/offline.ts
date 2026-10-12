export interface OfflineState {
  ready: boolean;
  update: boolean;
  error: string;
}
export function registerOffline(onState: (s: OfflineState) => void) {
  let state: OfflineState = { ready: false, update: false, error: "" };
  const report = (patch: Partial<OfflineState>) => {
    state = { ...state, ...patch };
    onState(state);
  };
  if (!("serviceWorker" in navigator)) {
    report({ error: "此瀏覽器不支援離線安裝，仍可連線遊玩。" });
    return () => {};
  }
  const message = (e: MessageEvent) => {
    if (e.data?.type === "CACHE_READY" && navigator.serviceWorker.controller)
      report({ ready: true, error: "" });
    if (e.data?.type === "CACHE_ERROR")
      report({ error: "離線素材下載未完成，請連線後重新開啟。" });
  };
  navigator.serviceWorker.addEventListener("message", message);
  const controlled = () =>
    navigator.serviceWorker.controller?.postMessage({ type: "STATUS" });
  navigator.serviceWorker.addEventListener("controllerchange", controlled);
  navigator.serviceWorker
    .register(`${import.meta.env.BASE_URL}sw.js`, {
      scope: import.meta.env.BASE_URL,
    })
    .then((reg) => {
      if (reg.waiting) report({ update: true });
      reg.addEventListener("updatefound", () => {
        const worker = reg.installing;
        worker?.addEventListener("statechange", () => {
          if (
            worker.state === "installed" &&
            navigator.serviceWorker.controller
          )
            report({ update: true });
        });
      });
      navigator.serviceWorker.ready.then((r) =>
        r.active?.postMessage({ type: "STATUS" }),
      );
    })
    .catch(() => report({ error: "離線安裝失敗，請確認已連線。" }));
  return () => {
    navigator.serviceWorker.removeEventListener("message", message);
    navigator.serviceWorker.removeEventListener("controllerchange", controlled);
  };
}
export async function applyUpdate() {
  const reg = await navigator.serviceWorker.getRegistration(
    import.meta.env.BASE_URL,
  );
  if (reg?.waiting) {
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      () => location.reload(),
      { once: true },
    );
    reg.waiting.postMessage({ type: "SKIP_WAITING" });
  } else location.reload();
}
