"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart } from "@/lib/cart";
import { useLocale } from "@/lib/locale";
import { formatQar } from "@/lib/money";
import { waLink } from "@/lib/site";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function CartSheet({ open, onClose }: Props) {
  const { lines, totalQar, inc, dec, clear, comment, setComment } = useCart();
  const { lang, t } = useLocale();
  const closeRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ start: 0, dy: 0, tracking: false, t: 0 });
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const router = useRouter();

  function close() {
    drag.current.tracking = false;
    setDragging(false);
    setDragY(0);
    onClose();
  }

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const empty = lines.length === 0;
  const wa = whatsappHref(lines, totalQar, comment, t, lang);

  function onPointerDown(e: PointerEvent) {
    const sheet = sheetRef.current;
    if (!sheet || e.button !== 0) return;
    const target = e.target as HTMLElement;
    const onGrab = Boolean(target.closest(".sheet-grab"));
    const onControl = Boolean(target.closest("button, a, input, textarea, label"));
    if (onControl && !onGrab) return;
    if (!onGrab && sheet.scrollTop > 2) return;
    drag.current = { start: e.clientY, dy: 0, tracking: true, t: performance.now() };
  }

  function onPointerMove(e: PointerEvent) {
    if (!drag.current.tracking) return;
    const sheet = sheetRef.current;
    const dy = e.clientY - drag.current.start;
    if (dy < -8 && drag.current.dy < 10) {
      releaseDrag(e.pointerId);
      return;
    }
    if (dy < 10) return;
    if (sheet && !sheet.hasPointerCapture(e.pointerId)) sheet.setPointerCapture(e.pointerId);
    e.preventDefault();
    drag.current.dy = dy;
    setDragging(true);
    setDragY(dy);
  }

  function releaseDrag(pointerId: number) {
    const sheet = sheetRef.current;
    drag.current.tracking = false;
    if (sheet?.hasPointerCapture(pointerId)) sheet.releasePointerCapture(pointerId);
  }

  function endDrag(e: PointerEvent) {
    if (!drag.current.tracking) return;
    const { dy, t } = drag.current;
    const speed = dy / Math.max(1, performance.now() - t);
    releaseDrag(e.pointerId);
    setDragging(false);
    setDragY(0);
    if (dy > 88 || speed > 0.55) onClose();
  }

  return (
    <div className="sheet-root">
      <button type="button" className="sheet-backdrop" aria-label={t.closeTicket} onClick={close} />
      <div
        ref={sheetRef}
        className={`ticket${dragging ? " is-dragging" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ticket-title"
        style={{ transform: dragY ? `translate3d(0, ${dragY}px, 0)` : undefined }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div className="sheet-grab sheet-grab-ink" aria-hidden="true" />
        <div className="ticket-scallop" aria-hidden="true" />
        <header className="ticket-head">
          <div>
            <p className="ticket-kicker">{t.brand}</p>
            <h2 id="ticket-title" className="ticket-title">
              {t.yourTicket}
            </h2>
          </div>
          <button ref={closeRef} type="button" className="ticket-close" onClick={close}>
            {t.close}
          </button>
        </header>
        <p className="ticket-rule" aria-hidden="true" />

        {empty ? (
          <p className="ticket-empty-title">{t.emptyTicket}</p>
        ) : (
          <>
            <ul className="ticket-lines">
              {lines.map((line) => (
                <li key={line.key} className="ticket-line">
                  <div className="line-main">
                    <p className="line-name">{line.displayName}</p>
                    {line.meta ? <p className="line-meta">{line.meta}</p> : null}
                    {line.qty > 1 ? (
                      <p className="line-meta">
                        {line.qty} × {formatQar(line.unitQar, lang)}
                      </p>
                    ) : null}
                  </div>
                  <div className="line-qty">
                    <button
                      type="button"
                      className="qty-btn"
                      aria-label={t.fewerOf(line.displayName)}
                      onClick={() => dec(line.key)}
                    >
                      −
                    </button>
                    <span className="qty-num" aria-live="polite">
                      {line.qty}
                    </span>
                    <button
                      type="button"
                      className="qty-btn"
                      aria-label={t.moreOf(line.displayName)}
                      onClick={() => inc(line.key)}
                    >
                      +
                    </button>
                  </div>
                  <p className="line-total">{formatQar(line.lineTotal, lang)}</p>
                </li>
              ))}
            </ul>

            <label className="order-comment">
              <span>{t.comment}</span>
              <textarea
                value={comment}
                maxLength={400}
                rows={3}
                placeholder={t.commentPlaceholder}
                onChange={(e) => setComment(e.target.value)}
              />
            </label>

            <div className="ticket-sum">
              <span>{t.total}</span>
              <strong>{formatQar(totalQar, lang)}</strong>
            </div>

            <button
              type="button"
              className="wa-btn"
              onClick={() => {
                window.open(wa, "_blank", "noopener,noreferrer");
                router.push("/thank-you");
              }}
            >
              {t.sendWhatsApp}
            </button>

            <p className="ticket-legal">
              <Link href="/privacy">{t.privacy}</Link>
              {" · "}
              <Link href="/terms">{t.terms}</Link>
              {" · "}
              <Link href="/contact">{t.contact}</Link>
            </p>

            <button type="button" className="clear-ticket" onClick={clear}>
              {t.clear}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function whatsappHref(
  lines: { qty: number; displayName: string; meta: string; lineTotal: number }[],
  total: number,
  comment: string,
  t: { ticketWord: string; total: string; commentWord: string },
  lang: "en" | "ar",
) {
  const note = comment.trim();
  const body = [
    t.ticketWord,
    "",
    ...lines.map((l) => {
      const meta = l.meta ? ` (${l.meta})` : "";
      return `• ${l.qty}× ${l.displayName}${meta} — ${formatQar(l.lineTotal, lang)}`;
    }),
    "",
    `${t.total}: ${formatQar(total, lang)}`,
    ...(note ? ["", `${t.commentWord}: ${note}`] : []),
  ].join("\n");
  return waLink(body);
}
