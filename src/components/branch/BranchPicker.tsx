"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type MouseEvent } from "react";
import { BRANCHES, BRANCH_COOKIE, type Branch } from "@/branches/branches";
import { accessibleName, branchStatus, qatarClock } from "@/branches/hours";
import { useMenu } from "@/cms/context";
import { LangButton, useLocale } from "@/i18n/locale";
import { Nigiri } from "./Nigiri";
import "./branch-picker.css";

const PICK_MS = 860;
const EASE = "cubic-bezier(0.23, 1, 0.32, 1)";
const SETTLE = "cubic-bezier(.45,0,.25,1)";
const LIFT = -76;

// The status line re-reads the clock every minute and when the tab comes back.
function subscribeToMinutes(onChange: () => void) {
  const timer = window.setInterval(onChange, 60_000);
  document.addEventListener("visibilitychange", onChange);
  return () => {
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", onChange);
  };
}
const currentMinute = () => Math.floor(Date.now() / 60_000);
const noMinuteOnServer = () => null;

// Read by src/proxy.ts, so the next visit to "/" opens this branch.
function rememberBranch(slug: string) {
  document.cookie = `${BRANCH_COOKIE}=${slug};path=/;max-age=31536000;SameSite=Lax`;
}

export function BranchPicker() {
  const { settings } = useMenu();
  const { t, lang } = useLocale();
  const ar = lang === "ar";
  const router = useRouter();
  const minute = useSyncExternalStore(subscribeToMinutes, currentMinute, noMinuteOnServer);
  const clock = minute === null ? null : qatarClock(new Date(minute * 60_000));
  const [picked, setPicked] = useState<string | null>(null);
  const shellRef = useRef<HTMLElement>(null);
  const chopRef = useRef<HTMLDivElement>(null);
  const sticksRef = useRef<HTMLDivElement>(null);
  const animations = useRef<Animation[]>([]);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => {
    window.clearTimeout(timer.current);
    animations.current.forEach((a) => a.cancel());
  }, []);

  function pick(event: MouseEvent<HTMLAnchorElement>, branch: Branch) {
    // Let new-tab and other modified clicks behave like a normal link.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (picked) return;
    rememberBranch(branch.slug);
    const href = `/${branch.slug}`;
    const shell = shellRef.current;
    const chop = chopRef.current;
    const piece = event.currentTarget.querySelector<HTMLElement>(".bp-piece");
    const [s1, s2] = Array.from(sticksRef.current?.children ?? []) as HTMLElement[];
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !shell || !chop || !piece || !s1 || !s2 || typeof chop.animate !== "function") {
      router.push(href);
      return;
    }
    setPicked(branch.slug);
    const dir = getComputedStyle(shell).direction === "rtl" ? -1 : 1;
    const sr = shell.getBoundingClientRect();
    const pr = piece.getBoundingClientRect();
    chop.style.left = `${pr.left - sr.left + pr.width / 2}px`;
    chop.style.top = `${pr.top - sr.top + pr.height * 0.42}px`;
    const timing = { duration: PICK_MS, fill: "forwards" } as const;
    const lifted = `translate3d(${6 * dir}px, ${LIFT}px, 0)`;
    // 0–42% fly in open, 42–60% close on the piece, 60–100% lift together.
    animations.current = [
      chop.animate([
        { opacity: 0, transform: `translate3d(${230 * dir}px, -300px, 0)`, offset: 0, easing: EASE },
        { opacity: 1, transform: "translate3d(0, 0, 0)", offset: 0.42, easing: "linear" },
        { opacity: 1, transform: "translate3d(0, 0, 0)", offset: 0.6, easing: SETTLE },
        { opacity: 1, transform: lifted, offset: 1 },
      ], timing),
      s1.animate([
        { transform: "rotate(9deg)", offset: 0 }, { transform: "rotate(9deg)", offset: 0.42 },
        { transform: "rotate(4.6deg)", offset: 0.6 }, { transform: "rotate(4.6deg)", offset: 1 },
      ], timing),
      s2.animate([
        { transform: "rotate(-9deg)", offset: 0 }, { transform: "rotate(-9deg)", offset: 0.42 },
        { transform: "rotate(-4.6deg)", offset: 0.6 }, { transform: "rotate(-4.6deg)", offset: 1 },
      ], timing),
      piece.animate([
        { transform: "none", offset: 0 }, { transform: "none", offset: 0.6, easing: SETTLE },
        { transform: `${lifted} rotate(${-4 * dir}deg) scale(1.06)`, offset: 1 },
      ], timing),
    ];
    timer.current = window.setTimeout(() => router.push(href), PICK_MS + 60);
  }

  return (
    <main ref={shellRef} id="main" className="bp-shell">
      <header className="bp-top">
        <img src={settings.logo} alt={t.brand} width={54} height={52} />
        <div>
          <h1>{ar ? "اختر فرعك" : "Choose your branch"}</h1>
          <p>{ar ? "اضغط على قطعة السوشي لفتح القائمة" : "Tap a piece to open its menu"}</p>
        </div>
        <LangButton />
      </header>
      <nav aria-label={ar ? "الفروع" : "Branches"}>
        <ul className={`bp-board${picked ? " is-picking" : ""}`}>
          {BRANCHES.map((branch, i) => {
            const status = clock && branchStatus(branch.hours, clock, lang);
            const tone = !status ? "" : !status.open ? "closed" : status.soon ? "soon" : "open";
            return (
              <li key={branch.slug} className={`bp-row${picked === branch.slug ? " is-picked" : ""}`}>
                <Link href={`/${branch.slug}`} className={`bp-pick${status && !status.open ? " is-closed" : ""}`}
                  style={{ "--i": i } as CSSProperties} aria-label={status ? accessibleName(ar ? branch.nameAr : branch.name, status, lang) : undefined}
                  onClick={(e) => pick(e, branch)}>
                  <span className="bp-piece"><Nigiri kind={branch.nigiri} /></span>
                  <span className="bp-info">
                    <span className="bp-name">{ar ? branch.nameAr : branch.name}</span>
                    <span className="bp-hours">{status?.hours}</span>
                    <span className={`bp-status${tone ? ` is-${tone}` : ""}`}>{status?.label}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div ref={chopRef} className="bp-chop" aria-hidden="true">
        <div ref={sticksRef} className="bp-arm"><div className="bp-stick" /><div className="bp-stick" /></div>
      </div>
    </main>
  );
}
