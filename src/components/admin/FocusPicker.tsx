"use client";
import type { KeyboardEvent, PointerEvent } from "react";
type Focus = { x: number; y: number };
const clamp = (n: number) => Math.round(Math.min(100, Math.max(0, n)));
const keys: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};
// Tap or drag on the whole photo to choose what the tall card crop keeps in
// view; arrow keys nudge by 1% (Shift: 10%). The centre is stored as "unset".
export function FocusPicker({
  src,
  value,
  onChange,
}: {
  src: string;
  value?: Focus;
  onChange: (f: Focus | undefined) => void;
}) {
  const f = value ?? { x: 50, y: 50 };
  const set = (x: number, y: number) => {
    const next = { x: clamp(x), y: clamp(y) };
    onChange(next.x === 50 && next.y === 50 ? undefined : next);
  };
  const point = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    set(
      ((e.clientX - r.left) / r.width) * 100,
      ((e.clientY - r.top) / r.height) * 100,
    );
  };
  return (
    <div className="admin-focus">
      <div
        className="admin-focus-photo"
        role="slider"
        tabIndex={0}
        aria-label="Card focal point"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={f.x}
        aria-valuetext={`${f.x}% across, ${f.y}% down`}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          point(e);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) point(e);
        }}
        onKeyDown={(e: KeyboardEvent) => {
          const d = keys[e.key];
          if (!d) return;
          e.preventDefault();
          const step = e.shiftKey ? 10 : 1;
          set(f.x + d[0] * step, f.y + d[1] * step);
        }}
      >
        <img src={src} alt="" draggable={false} />
        <span
          className="admin-focus-marker"
          style={{ left: `${f.x}%`, top: `${f.y}%` }}
          aria-hidden="true"
        />
      </div>
      <figure className="admin-focus-preview">
        <img src={src} alt="" style={{ objectPosition: `${f.x}% ${f.y}%` }} />
        <figcaption>Card</figcaption>
      </figure>
      <p className="admin-focus-note">
        <small>
          Tap the photo to choose what the card keeps in view. Arrow keys nudge
          it.
        </small>
        {value && (
          <button type="button" onClick={() => onChange(undefined)}>
            Centre
          </button>
        )}
      </p>
    </div>
  );
}
