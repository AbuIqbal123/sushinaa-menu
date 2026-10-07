"use client";

import { useEffect, useRef, type PointerEvent } from "react";
import Link from "next/link";
import { useCart } from "@/ordering/cart";
import { useLocale } from "@/i18n/locale";
import { useMenu } from "@/cms/context";
import { formatQar } from "@/lib/money";
import { useSheetDismiss } from "@/lib/sheet-dismiss";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function CartSheet({ open, onClose }: Props) {
  const { lines, totalQar, inc, dec, clear } = useCart();
  const { lang, t } = useLocale();
  const { settings } = useMenu();
  const closeRef = useRef<HTMLButtonElement>(null);
  const { sheetRef, backdropRef, trackPointer, movePointer, endPointer, requestClose } =
    useSheetDismiss(open, onClose);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") requestClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, requestClose]);

  if (!open) return null;

  const empty = lines.length === 0;

  function onPointerDown(e: PointerEvent) {
    const sheet = sheetRef.current;
    if (!sheet) return;
    const target = e.target as HTMLElement;
    const onGrab = Boolean(target.closest(".sheet-grab"));
    const onControl = Boolean(target.closest("button, a, input, textarea, label"));
    if (onControl && !onGrab) return;
    if (!onGrab && sheet.scrollTop > 2) return;
    trackPointer(e);
  }

  return (
    <div className="sheet-root">
      <button
        ref={backdropRef}
        type="button"
        className="sheet-backdrop"
        aria-label={t.closeTicket}
        onClick={requestClose}
      />
      <div
        ref={sheetRef}
        className="ticket"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ticket-title"
        onPointerDown={onPointerDown}
        onPointerMove={movePointer}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
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
          <button ref={closeRef} type="button" className="ticket-close" onClick={requestClose}>
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
                    {line.note ? (
                      <p className="line-note">
                        {t.commentWord}: {line.note}
                      </p>
                    ) : null}
                    {line.qty > 1 ? (
                      <p className="line-meta">
                        {line.qty} × {formatQar(line.unitQar, lang, settings)}
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
                  <p className="line-total">{formatQar(line.lineTotal, lang, settings)}</p>
                </li>
              ))}
            </ul>

            <div className="ticket-sum">
              <span>{t.total}</span>
              <strong>{formatQar(totalQar, lang, settings)}</strong>
            </div>

            <p className="view-only-notice">{t.viewOnlyNotice}</p>

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
