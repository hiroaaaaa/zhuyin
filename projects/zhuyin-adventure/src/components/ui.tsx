import { useEffect, useRef } from "react";
const BASE = import.meta.env.BASE_URL;
export function Glyph({ id, large = false }: { id: string; large?: boolean }) {
  return (
    <img
      className={large ? "glyph large" : "glyph"}
      src={`${BASE}glyphs/${id}.svg`}
      alt=""
      aria-hidden="true"
    />
  );
}
export function Bunny({ small = false }: { small?: boolean }) {
  return (
    <img
      className={small ? "bunny small" : "bunny"}
      src={`${BASE}icon.svg`}
      alt="小兔嚮導"
    />
  );
}
export function navigate(path: string) {
  location.hash = path;
}
export function Button({
  children,
  onClick,
  secondary = false,
  disabled = false,
  className = "",
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  secondary?: boolean;
  disabled?: boolean;
  className?: string;
  label?: string;
}) {
  return (
    <button
      aria-label={label}
      className={`button ${secondary ? "secondary" : ""} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
export function Header({
  title,
  back = "/menu",
  onBack,
}: {
  title: string;
  back?: string;
  onBack?: () => void;
}) {
  return (
    <header className="topbar">
      <button
        className="icon-button"
        aria-label="返回"
        onClick={onBack || (() => navigate(back))}
      >
        ‹
      </button>
      <h1>{title}</h1>
      <Bunny small />
    </header>
  );
}
export function Modal({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement;
    const first = ref.current?.querySelector<HTMLElement>("button,input");
    first?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const list = Array.from(
        ref.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input,a[href]",
        ) || [],
      );
      if (!list.length) return;
      const first = list[0],
        last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        last.focus();
        e.preventDefault();
      } else if (!e.shiftKey && document.activeElement === last) {
        first.focus();
        e.preventDefault();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      prev?.focus();
    };
  }, []);
  return (
    <div className="overlay">
      <div
        className="dialog"
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {children}
      </div>
    </div>
  );
}
