"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const KEY = "sushina-consent";

export function getConsent(): "all" | "necessary" | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(KEY);
  if (v === "all" || v === "necessary") return v;
  return null;
}

export function CookieBanner() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(getConsent() == null);
  }, []);

  function choose(value: "all" | "necessary") {
    localStorage.setItem(KEY, value);
    window.dispatchEvent(new Event("sushina-consent"));
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="cookie" role="dialog" aria-labelledby="cookie-title" aria-live="polite">
      <div className="cookie-inner">
        <p id="cookie-title" className="cookie-title">
          Cookies
        </p>
        <p className="cookie-copy">
          We store your ticket on this device so the order is not lost if you refresh. Optional
          analytics (Vercel) only run if you accept. See the{" "}
          <Link href="/privacy">privacy policy</Link>.
        </p>
        <div className="cookie-actions">
          <button type="button" className="cookie-btn cookie-btn-ghost" onClick={() => choose("necessary")}>
            Necessary only
          </button>
          <button type="button" className="cookie-btn cookie-btn-solid" onClick={() => choose("all")}>
            Accept analytics
          </button>
        </div>
      </div>
    </div>
  );
}
