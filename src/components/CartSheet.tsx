"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart } from "@/lib/cart";
import { formatQar } from "@/lib/money";
import { waLink } from "@/lib/site";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function CartSheet({ open, onClose }: Props) {
  const { lines, totalQar, inc, dec, clear } = useCart();
  const closeRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();

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
  const wa = whatsappHref(lines, totalQar);

  return (
    <div className="sheet-root">
      <button type="button" className="sheet-backdrop" aria-label="Close ticket" onClick={onClose} />
      <div className="ticket" role="dialog" aria-modal="true" aria-labelledby="ticket-title">
        <div className="ticket-scallop" aria-hidden="true" />
        <header className="ticket-head">
          <div>
            <p className="ticket-kicker">Sushinaa</p>
            <h2 id="ticket-title" className="ticket-title">
              Your ticket
            </h2>
          </div>
          <button ref={closeRef} type="button" className="ticket-close" onClick={onClose}>
            Close
          </button>
        </header>
        <p className="ticket-rule" aria-hidden="true" />

        {empty ? (
          <p className="ticket-empty-title">Empty — swipe the menu and tap to add.</p>
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
                        {line.qty} × {formatQar(line.unitQar)}
                      </p>
                    ) : null}
                  </div>
                  <div className="line-qty">
                    <button
                      type="button"
                      className="qty-btn"
                      aria-label={`Fewer ${line.displayName}`}
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
                      aria-label={`More ${line.displayName}`}
                      onClick={() => inc(line.key)}
                    >
                      +
                    </button>
                  </div>
                  <p className="line-total">{formatQar(line.lineTotal)}</p>
                </li>
              ))}
            </ul>

            <div className="ticket-sum">
              <span>Total</span>
              <strong>{formatQar(totalQar)}</strong>
            </div>

            <button
              type="button"
              className="wa-btn"
              onClick={() => {
                window.open(wa, "_blank", "noopener,noreferrer");
                router.push("/thank-you");
              }}
            >
              Send on WhatsApp
            </button>

            <p className="ticket-legal">
              <Link href="/privacy">Privacy</Link>
              {" · "}
              <Link href="/terms">Terms</Link>
              {" · "}
              <Link href="/contact">Contact</Link>
            </p>

            <button type="button" className="clear-ticket" onClick={clear}>
              Clear
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
) {
  const body = [
    "Sushinaa ticket",
    "",
    ...lines.map((l) => {
      const meta = l.meta ? ` (${l.meta})` : "";
      return `• ${l.qty}× ${l.displayName}${meta} — ${l.lineTotal} QAR`;
    }),
    "",
    `Total: ${total} QAR`,
  ].join("\n");
  return waLink(body);
}
