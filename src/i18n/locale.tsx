"use client";

import { useMenu } from "@/cms/context";
import { useRouter } from "next/navigation";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
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
  const router = useRouter();
  const { copy } = useMenu();
  const [lang, setLangState] = useState<Lang>(initial);
  const t = useMemo(() => strings(lang, copy), [lang, copy]);

  function setLang(next: Lang) {
    setLangState(next);
    document.documentElement.lang = next;
    document.documentElement.dir = next === "ar" ? "rtl" : "ltr";
    document.cookie = `${COOKIE}=${next};path=/;max-age=31536000;SameSite=Lax`;
    router.refresh();
  }

  return (
    <LocaleContext.Provider value={{ lang, t, setLang }}>
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
      className={tone === "dark" ? "cart-btn lang-btn" : "lang-btn"}
      onClick={() => setLang(next)}
      aria-label={t.langButtonLabel}
    >
      <span lang={next}>{t.langButton}</span>
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
