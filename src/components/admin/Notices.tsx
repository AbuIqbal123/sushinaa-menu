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

export function Notices({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<Notice | null>(null);
  const timer = useRef(0);
  const pop = useRef<HTMLDivElement>(null);
  const dismiss = useCallback(() => {
    window.clearTimeout(timer.current);
    setNotice(null);
  }, []);
  const notify = useCallback(
    (next: Notice) => {
      window.clearTimeout(timer.current);
      setNotice(next);
      timer.current = window.setTimeout(
        dismiss,
        next.tone === "error" ? 8000 : 4200,
      );
    },
    [dismiss],
  );
  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    const el = pop.current;
    if (!el) return;
    if (notice && !el.matches(":popover-open")) el.showPopover();
    if (!notice && el.matches(":popover-open")) el.hidePopover();
  }, [notice]);
  return (
    <Notify.Provider value={notify}>
      {children}
      <div className="admin-toasts" popover="manual" ref={pop}>
        {notice && (
          <div
            className={`admin-toast${notice.tone === "error" ? " is-error" : ""}`}
            role={notice.tone === "error" ? "alert" : "status"}
          >
            <p>{notice.text}</p>
            {notice.action && (
              <button type="button" onClick={notice.action.onClick}>
                {notice.action.label}
              </button>
            )}
            <button type="button" aria-label="Dismiss" onClick={dismiss}>
              ×
            </button>
          </div>
        )}
      </div>
    </Notify.Provider>
  );
}
