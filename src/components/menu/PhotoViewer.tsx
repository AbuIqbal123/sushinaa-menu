"use client";

import { useEffect, useLayoutEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";

type Box = { x: number; y: number; w: number; h: number };
// The frame clips (W); the photo inside is drawn at I. Both in viewport px.
type State = { W: Box; I: Box; o: number };

const EASE = "cubic-bezier(0.23, 1, 0.32, 1)";
const OPEN_MS = 250;
const MAX_ZOOM = 4;
const SAMPLES = 12;

const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const lerpBox = (a: Box, b: Box, u: number): Box => ({
  x: lerp(a.x, b.x, u),
  y: lerp(a.y, b.y, u),
  w: lerp(a.w, b.w, u),
  h: lerp(a.h, b.h, u),
});
const rect = (e: Element): Box => {
  const r = e.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
};

/** The photo contained in the viewport. */
function fit(nw: number, nh: number): Box {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const k = Math.min(vw / nw, vh / nh);
  return { x: (vw - nw * k) / 2, y: (vh - nh * k) / 2, w: nw * k, h: nh * k };
}

/** Where the photo is drawn when it covers `box` at object-position (px, py). */
function cover(box: Box, F: Box, [px, py]: [number, number]): Box {
  const k = Math.max(box.w / F.w, box.h / F.h);
  const w = F.w * k;
  const h = F.h * k;
  return { x: box.x + (box.w - w) * px, y: box.y + (box.h - h) * py, w, h };
}

/** Transforms that draw the frame at W and the photo at I, both laid out at F. */
function transforms(F: Box, W: Box, I: Box) {
  const sx = W.w / F.w;
  const sy = W.h / F.h;
  return {
    frame: `translate(${W.x - F.x}px, ${W.y - F.y}px) scale(${sx}, ${sy})`,
    photo: `translate(${(I.x - W.x) / sx}px, ${(I.y - W.y) / sy}px) scale(${I.w / F.w / sx}, ${I.h / F.h / sy})`,
  };
}

function objectPosition(img: HTMLImageElement): [number, number] {
  const [x = "50%", y = "50%"] = getComputedStyle(img).objectPosition.split(" ");
  const pct = (v: string) => (v.endsWith("%") ? parseFloat(v) / 100 : 0.5);
  return [pct(x), pct(y)];
}

type Props = {
  src: string;
  alt: string;
  closeLabel: string;
  /** The on-page photo the viewer grows from and shrinks back to. */
  from: HTMLElement;
  onClose: () => void;
};

/**
 * Full-screen photo: grows from the on-page photo, pinch or double-tap to
 * zoom, drag to pan, and tap, swipe down, Escape or the close button to
 * shrink back. Animates transform and opacity only.
 */
export function PhotoViewer({ src, alt, closeLabel, from, onClose }: Props) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const photoRef = useRef<HTMLImageElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const live = useRef({
    F: { x: 0, y: 0, w: 1, h: 1 } as Box,
    state: null as State | null,
    anims: [] as Animation[],
    opening: false,
    closing: false,
    pointers: new Map<number, { x: number; y: number }>(),
    gesture: null as null | {
      start: State;
      x: number;
      y: number;
      t: number;
      dist?: number;
      moved: boolean;
    },
    lastTap: { t: 0, x: 0, y: 0 },
    tapTimer: 0,
  });

  const reduce = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Place the frame and photo; every visual change after layout is a transform.
  function paint(s: State) {
    const l = live.current;
    l.state = s;
    const t = transforms(l.F, s.W, s.I);
    frameRef.current!.style.transform = t.frame;
    photoRef.current!.style.transform = t.photo;
    backdropRef.current!.style.opacity = String(s.o);
    closeRef.current!.style.opacity = String(s.o);
  }

  function animate(to: State, ms: number, done?: () => void) {
    const l = live.current;
    l.anims.forEach((a) => a.cancel());
    const start = l.state!;
    if (reduce()) {
      paint(to);
      done?.();
      return;
    }
    const frames = Array.from({ length: SAMPLES + 1 }, (_, i) => {
      const u = i / SAMPLES;
      return transforms(l.F, lerpBox(start.W, to.W, u), lerpBox(start.I, to.I, u));
    });
    const opts = { duration: ms, easing: EASE, fill: "forwards" as const };
    const fade = [{ opacity: start.o }, { opacity: to.o }];
    l.anims = [
      frameRef.current!.animate(frames.map((f) => ({ transform: f.frame })), opts),
      photoRef.current!.animate(frames.map((f) => ({ transform: f.photo })), opts),
      backdropRef.current!.animate(fade, opts),
      closeRef.current!.animate(fade, opts),
    ];
    paint(to);
    l.anims[0].onfinish = () => {
      l.anims.forEach((a) => a.cancel());
      l.anims = [];
      done?.();
    };
  }

  function origin(): State {
    const l = live.current;
    const img = from.querySelector("img");
    const O = rect(from);
    return { W: O, I: cover(O, l.F, img ? objectPosition(img) : [0.5, 0.5]), o: 0 };
  }

  function close() {
    const l = live.current;
    if (l.closing) return;
    l.closing = true;
    window.clearTimeout(l.tapTimer);
    // Closing mid-open runs the same motion backwards from where it is.
    if (l.opening && l.anims.length) {
      l.anims.forEach((a) => a.reverse());
      l.anims[0].onfinish = onClose;
      return;
    }
    animate(origin(), OPEN_MS, onClose);
  }

  useLayoutEffect(() => {
    const l = live.current;
    const img = from.querySelector("img");
    l.F = fit(img?.naturalWidth || 1, img?.naturalHeight || 1);
    const { x, y, w, h } = l.F;
    Object.assign(frameRef.current!.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
    paint(origin());
    l.opening = true;
    animate({ W: l.F, I: l.F, o: 1 }, OPEN_MS, () => (l.opening = false));
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current!.focus({ preventScroll: true });
    const onResize = () => {
      l.F = fit(img?.naturalWidth || 1, img?.naturalHeight || 1);
      Object.assign(frameRef.current!.style, {
        left: `${l.F.x}px`, top: `${l.F.y}px`, width: `${l.F.w}px`, height: `${l.F.h}px`,
      });
      paint({ W: l.F, I: l.F, o: 1 });
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.clearTimeout(l.tapTimer);
      l.anims.forEach((a) => a.cancel());
      opener?.focus({ preventScroll: true });
    };
    // Opens once per mount; `from` is fixed for the viewer's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Capture phase, so the sheet underneath doesn't also close on Escape.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      } else if (e.key === "Tab") {
        e.preventDefault(); // the close button is the only stop
        closeRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  /** Keep a zoomed photo covering the screen, or settle it back to fit. */
  function settle(I: Box): Box {
    const F = live.current.F;
    if (I.w <= F.w * 1.02) return F;
    const w = Math.min(I.w, F.w * MAX_ZOOM);
    const h = (w / F.w) * F.h;
    const cx = I.x + I.w / 2;
    const cy = I.y + I.h / 2;
    const clamp = (pos: number, size: number, view: number) =>
      size <= view ? (view - size) / 2 : Math.min(0, Math.max(view - size, pos));
    return {
      x: clamp(cx - w / 2, w, window.innerWidth),
      y: clamp(cy - h / 2, h, window.innerHeight),
      w,
      h,
    };
  }

  function zoomAt(I: Box, x: number, y: number, k: number): Box {
    return { x: x - (x - I.x) * k, y: y - (y - I.y) * k, w: I.w * k, h: I.h * k };
  }

  function onPointerDown(e: ReactPointerEvent) {
    e.stopPropagation(); // the sheet below would start a drag otherwise
    const l = live.current;
    if (l.closing || (e.target as Element).closest("button")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    l.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    l.anims.forEach((a) => a.finish());
    l.opening = false;
    const pts = [...l.pointers.values()];
    const mid = pts.length === 2
      ? { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 }
      : pts[0];
    l.gesture = {
      start: l.state!,
      x: mid.x,
      y: mid.y,
      t: performance.now(),
      dist: pts.length === 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : undefined,
      moved: pts.length > 1,
    };
  }

  function onPointerMove(e: ReactPointerEvent) {
    e.stopPropagation();
    const l = live.current;
    const g = l.gesture;
    if (!g || !l.pointers.has(e.pointerId) || l.closing) return;
    l.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...l.pointers.values()];
    const { W, I } = g.start;
    if (pts.length === 2 && g.dist) {
      const mx = (pts[0].x + pts[1].x) / 2;
      const my = (pts[0].y + pts[1].y) / 2;
      const k = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) / g.dist;
      const z = zoomAt(I, g.x, g.y, k);
      paint({ W, I: { ...z, x: z.x + mx - g.x, y: z.y + my - g.y }, o: 1 });
      return;
    }
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (!g.moved && Math.hypot(dx, dy) < 8) return;
    g.moved = true;
    if (I.w > l.F.w * 1.02) {
      paint({ W, I: { ...I, x: I.x + dx, y: I.y + dy }, o: 1 });
      return;
    }
    // Fitted: a downward drag carries the photo away and fades the backdrop.
    const down = Math.max(0, dy);
    const shift = (b: Box) => ({ ...b, x: b.x + dx * 0.4, y: b.y + down });
    paint({ W: shift(W), I: shift(I), o: Math.max(0, 1 - down / 360) });
  }

  function onPointerUp(e: ReactPointerEvent) {
    e.stopPropagation();
    const l = live.current;
    const g = l.gesture;
    if (!l.pointers.delete(e.pointerId) || !g || l.closing) return;
    if (l.pointers.size) {
      // One finger lifted mid-pinch: continue as a pan from here.
      const [p] = [...l.pointers.values()];
      l.gesture = { start: l.state!, x: p.x, y: p.y, t: performance.now(), moved: true };
      return;
    }
    l.gesture = null;
    const s = l.state!;
    const fitted = s.I.w <= l.F.w * 1.02;
    if (g.moved) {
      const down = s.W.y - l.F.y;
      const speed = down / Math.max(1, performance.now() - g.t);
      if (fitted && (down > 120 || (down > 24 && speed > 0.6))) close();
      else animate({ W: l.F, I: settle(s.I), o: 1 }, 200);
      return;
    }
    // A tap: a second one soon after zooms; a single one closes a fitted photo.
    const now = performance.now();
    const last = l.lastTap;
    if (now - last.t < 280 && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 32) {
      window.clearTimeout(l.tapTimer);
      l.lastTap = { t: 0, x: 0, y: 0 };
      const I = fitted ? settle(zoomAt(s.I, e.clientX, e.clientY, 2.5)) : l.F;
      animate({ W: l.F, I, o: 1 }, 220);
      return;
    }
    l.lastTap = { t: now, x: e.clientX, y: e.clientY };
    if (fitted) l.tapTimer = window.setTimeout(close, 280);
  }

  function onPointerCancel(e: ReactPointerEvent) {
    e.stopPropagation();
    const l = live.current;
    l.pointers.delete(e.pointerId);
    if (l.pointers.size || l.closing || !l.state) return;
    l.gesture = null;
    animate({ W: l.F, I: settle(l.state.I), o: 1 }, 200);
  }

  return createPortal(
    <div
      className="viewer"
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <div ref={backdropRef} className="viewer-backdrop" />
      <div ref={frameRef} className="viewer-frame">
        {/* eslint-disable-next-line @next/next/no-img-element -- same file the sheet already shows */}
        <img ref={photoRef} src={src} alt={alt} draggable={false} />
      </div>
      <button
        ref={closeRef}
        type="button"
        className="viewer-close"
        aria-label={closeLabel}
        onClick={(e) => {
          e.stopPropagation();
          close();
        }}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </div>,
    document.body,
  );
}
