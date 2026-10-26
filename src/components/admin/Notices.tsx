"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type Notice = {
  tone: "ok" | "error";
  text: string;
  action?: { label: string; onClick: () => void };
};

const Notify = createContext<(notice: Notice) => void>(() => {});

export function useNotify() {
  return useContext(Notify);
}

type Item = Notice & { id: number };

export function Notices({ children }: { children: ReactNode }) {
  const [notices, setNotices] = useState<Item[]>([]);
  const timers = useRef(new Map<number, number>());
  const pop = useRef<HTMLDivElement>(null);
  const dismiss = useCallback((id: number) => {
    window.clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setNotices((current) => current.filter((item) => item.id !== id));
  }, []);
  const notify = useCallback(
    (next: Notice) => {
      const id = Date.now() + Math.random();
      setNotices((current) => [...current, { ...next, id }].slice(-3));
      timers.current.set(id, window.setTimeout(() => dismiss(id), next.tone === "error" ? 8000 : 4200));
    },
    [dismiss],
  );
  useEffect(() => () => { for (const timer of timers.current.values()) window.clearTimeout(timer); }, []);
  useEffect(() => {
    const el = pop.current;
    if (!el) return;
    if (notices.length && !el.matches(":popover-open")) el.showPopover();
    if (!notices.length && el.matches(":popover-open")) el.hidePopover();
  }, [notices.length]);
  return (
    <Notify.Provider value={notify}>
      {children}
      <div className="admin-toasts" popover="manual" ref={pop}>
        {notices.map((notice) => (
          <div
            key={notice.id}
            className={`admin-toast${notice.tone === "error" ? " is-error" : ""}`}
            role={notice.tone === "error" ? "alert" : "status"}
          >
            <p>{notice.text}</p>
            {notice.action && (
              <button type="button" onClick={notice.action.onClick}>
                {notice.action.label}
              </button>
            )}
            <button type="button" aria-label="Dismiss" onClick={() => dismiss(notice.id)}>
              ×
            </button>
          </div>
        ))}
      </div>
    </Notify.Provider>
  );
}
