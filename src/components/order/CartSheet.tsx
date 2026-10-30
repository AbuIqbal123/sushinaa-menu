"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import Link from "next/link";
import { useCart } from "@/ordering/cart";
import { useLocale } from "@/i18n/locale";
import { useMenu } from "@/cms/context";
import { formatQar } from "@/lib/money";
import { useSheetDismiss } from "@/lib/sheet-dismiss";

type Props = {
  open: boolean;
  onClose: () => void;
  onPickup?: () => void;
};

export function CartSheet({ open, onClose, onPickup }: Props) {
  const { lines, totalQar, inc, dec, clear, unavailableCount } = useCart();
  const { lang, t } = useLocale();
  const { settings } = useMenu();
  const closeRef = useRef<HTMLButtonElement>(null);
  const driveTimer = useRef<number | null>(null);
  const [driving, setDriving] = useState(false);
  const { sheetRef, backdropRef, trackPointer, movePointer, endPointer, requestClose } =
    useSheetDismiss(open, onClose);

  useEffect(() => () => { if (driveTimer.current) window.clearTimeout(driveTimer.current); }, []);

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
              {lines.map((line, i) => (
                <li key={line.key} className="ticket-line stagger" style={{ "--i": Math.min(i, 6) } as CSSProperties}>
                  <div className="line-main">
                    <p className="line-name">{line.displayName}</p>
                    {line.meta ? <p className="line-meta">{line.meta}</p> : null}
                    {line.qty > 1 ? (
                      <p className="line-meta line-unit">
                        {line.qty} × {formatQar(line.unitQar, lang, settings)}
                      </p>
                    ) : null}
                    {line.note ? (
                      <p className="line-note">
                        {t.commentWord}: {line.note}
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

            {onPickup ? (
              <button type="button" className={`checkout-primary ticket-pickup${driving ? " is-driving" : ""}`} disabled={unavailableCount > 0} onClick={() => {
                if (driving) return;
                const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
                if (reduce) { onPickup(); return; }
                setDriving(true);
                driveTimer.current = window.setTimeout(() => { onPickup(); setDriving(false); }, 760);
              }}>
                <span className="pickup-label">{lang === "ar" ? "اطلب للاستلام" : "Order for pickup"}</span>
                <span className="pickup-car" aria-hidden="true"><LandCruiser /></span>
              </button>
            ) : (
              <p className="view-only-notice">{t.viewOnlyNotice}</p>
            )}

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

function LandCruiser() {
  return <svg className="land-cruiser" viewBox="0 0 108 54" width="112" height="52">
    <ellipse cx="54" cy="50" rx="42" ry="2" fill="#4a1512" opacity=".4" />
    <path fill="#f7f4ee" d="M6 46V32h6l10-18h40l12 14h26v18H6Z" />
    <path fill="#8a1538" d="M6 38h92v3.2H6Z" />
    <path fill="#1b1714" d="M26 18h26v14H24V20c0-1.1.9-2 2-2Zm30 0h24l8 14H56V18Z" />
    <circle cx="30" cy="46" r="7.4" fill="#171412" />
    <circle cx="30" cy="46" r="2.7" fill="#e7e1d6" />
    <circle cx="82" cy="46" r="7.4" fill="#171412" />
    <circle cx="82" cy="46" r="2.7" fill="#e7e1d6" />
    <rect x="58" y="32" width="15" height="6" rx="1" fill="#fff" stroke="#8a1538" strokeWidth=".8" />
    <path fill="#8a1538" d="M63.2 33.1h4.4v3.8h-4.4z" />
    <rect x="96" y="30" width="6" height="3.2" rx="1" fill="#f3e2a2" />
  </svg>;
}
