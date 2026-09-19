"use client";

import { useEffect, useState } from "react";
import { Analytics } from "@vercel/analytics/next";
import { getConsent } from "./CookieBanner";

export function AnalyticsGate() {
  const [allow, setAllow] = useState(false);

  useEffect(() => {
    function sync() {
      setAllow(getConsent() === "all");
    }
    sync();
    window.addEventListener("sushina-consent", sync);
    return () => window.removeEventListener("sushina-consent", sync);
  }, []);

  if (!allow) return null;
  return <Analytics />;
}
