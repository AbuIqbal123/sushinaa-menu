"use client";

import { useCallback, useLayoutEffect, useRef, type PointerEvent } from "react";

const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";

type Drag = {
  pointer: number;
  start: number;
  dy: number;
  lastY: number;
  lastT: number;
  velocity: number;
  tracking: boolean;
  active: boolean;
};

function readY(sheet: HTMLElement): number {
  const value = getComputedStyle(sheet).transform;
  if (!value || value === "none") return 0;
  return new DOMMatrix(value).m42;
}

export function useSheetDismiss(active: boolean, onClose: () => void) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLButtonElement>(null);
  const drag = useRef<Drag>({
    pointer: -1,
    start: 0,
    dy: 0,
    lastY: 0,
    lastT: 0,
    velocity: 0,
    tracking: false,
    active: false,
  });
  const closing = useRef(false);
  const closeRef = useRef(onClose);
  useLayoutEffect(() => { closeRef.current = onClose; }, [onClose]);

  useLayoutEffect(() => {
    closing.current = false;
    drag.current.tracking = false;
    drag.current.active = false;
    drag.current.dy = 0;
    if (!active) return;
    const sheet = sheetRef.current;
    if (!sheet) return;
    const onTouchMove = (e: TouchEvent) => {
      const d = drag.current;
      if (!d.tracking || closing.current) return;
      if (e.touches[0] && e.touches[0].clientY - d.start > 0 && e.cancelable) e.preventDefault();
    };
    sheet.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => sheet.removeEventListener("touchmove", onTouchMove);
  }, [active]);

  const requestClose = useCallback(() => {
    if (closing.current) return;
    const sheet = sheetRef.current;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!sheet || reduce) {
      closing.current = true;
      closeRef.current();
      return;
    }
    closing.current = true;
    drag.current.tracking = false;
    drag.current.active = false;
    const from = Math.max(0, readY(sheet));
    const travel = Math.max(1, sheet.getBoundingClientRect().height - from);
    const ms = Math.round(Math.min(320, Math.max(170, travel * 0.42)));
    sheet.style.animation = "none";
    sheet.style.willChange = "transform";
    sheet.style.transition = "none";
    sheet.style.transform = `translate3d(0, ${from}px, 0)`;
    sheet.getBoundingClientRect();
    sheet.style.transition = `transform ${ms}ms ${EASE}`;
    sheet.style.transform = `translate3d(0, ${from + travel + 48}px, 0)`;
    const backdrop = backdropRef.current;
    if (backdrop) {
      backdrop.style.transition = `opacity ${ms}ms linear`;
      backdrop.style.opacity = "0";
    }
    let settled = false;
    const onEnd = (e: TransitionEvent) => {
      if (e.target === sheet && e.propertyName === "transform") finish();
    };
    const finish = () => {
      if (settled) return;
      settled = true;
      sheet.removeEventListener("transitionend", onEnd);
      closeRef.current();
    };
    sheet.addEventListener("transitionend", onEnd);
    window.setTimeout(finish, ms + 90);
  }, []);

  const trackPointer = useCallback((e: PointerEvent) => {
    if (closing.current || e.button !== 0) return;
    drag.current = {
      pointer: e.pointerId,
      start: e.clientY,
      dy: 0,
      lastY: e.clientY,
      lastT: performance.now(),
      velocity: 0,
      tracking: true,
      active: false,
    };
  }, []);

  const movePointer = useCallback((e: PointerEvent) => {
    const d = drag.current;
    if (!d.tracking || closing.current || e.pointerId !== d.pointer) return;
    const now = performance.now();
    const dt = Math.max(1, now - d.lastT);
    d.velocity = (e.clientY - d.lastY) / dt;
    d.lastY = e.clientY;
    d.lastT = now;
    const dy = e.clientY - d.start;
    if (!d.active) {
      if (dy < -8) {
        d.tracking = false;
        return;
      }
      if (dy < 8) return;
      d.active = true;
      const sheet = sheetRef.current;
      if (sheet) {
        sheet.style.animation = "none";
        sheet.style.willChange = "transform";
        sheet.style.transition = "none";
        if (!sheet.hasPointerCapture(e.pointerId)) sheet.setPointerCapture(e.pointerId);
      }
    }
    const y = Math.max(0, dy);
    d.dy = y;
    const sheet = sheetRef.current;
    if (!sheet) return;
    sheet.style.transform = `translate3d(0, ${y}px, 0)`;
  }, []);

  const endPointer = useCallback((e: PointerEvent) => {
    const d = drag.current;
    if (!d.tracking || e.pointerId !== d.pointer) return;
    d.tracking = false;
    const sheet = sheetRef.current;
    if (sheet?.hasPointerCapture(e.pointerId)) sheet.releasePointerCapture(e.pointerId);
    if (!d.active || closing.current) return;
    d.active = false;
    if (d.dy > 88 || d.velocity > 0.55) {
      requestClose();
      return;
    }
    if (!sheet) return;
    const from = Math.max(0, readY(sheet));
    d.dy = 0;
    sheet.style.transition = "none";
    sheet.style.transform = `translate3d(0, ${from}px, 0)`;
    sheet.getBoundingClientRect();
    sheet.style.transition = `transform 260ms ${EASE}`;
    sheet.style.transform = "translate3d(0, 0, 0)";
    window.setTimeout(() => {
      if (!closing.current && sheet) sheet.style.willChange = "";
    }, 280);
  }, [requestClose]);

  return { sheetRef, backdropRef, trackPointer, movePointer, endPointer, requestClose };
}
