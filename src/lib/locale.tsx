"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { strings, type Copy } from "./copy";
import type { Lang } from "./localize";

const COOKIE = "sushina-lang";

type LocaleValue = {
  lang: Lang;
  t: Copy;
  setLang: (lang: Lang) => void;
};

const LocaleContext = createContext<LocaleValue | null>(null);

export function LocaleProvider({ initial, children }: { initial: Lang; children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initial);

  function setLang(next: Lang) {
    setLangState(next);
    document.documentElement.lang = next;
    document.documentElement.dir = next === "ar" ? "rtl" : "ltr";
    document.cookie = `${COOKIE}=${next};path=/;max-age=31536000;SameSite=Lax`;
  }

  return (
    <LocaleContext.Provider value={{ lang, t: strings(lang), setLang }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}

export function LangButton({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const { lang, setLang, t } = useLocale();
  const next: Lang = lang === "en" ? "ar" : "en";
  return (
    <button
      type="button"
      className={`lang-btn lang-btn-${tone}`}
      onClick={() => setLang(next)}
      aria-label={t.langButtonLabel}
    >
      {t.langButton}
    </button>
  );
}

export function SkipLink() {
  const { t } = useLocale();
  return (
    <a className="skip-link" href="#main">
      {t.skip}
    </a>
  );
}
