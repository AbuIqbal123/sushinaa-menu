"use client";

import { useMenu } from "@/cms/context";
import Link from "next/link";
import { LangButton, useLocale } from "@/i18n/locale";


export function LegalShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const { settings: SITE } = useMenu();
  const { t } = useLocale();
  return (
    <div className="doc-page">
      <header className="doc-nav">
        <Link href="/" className="doc-brand">
          <img src={SITE.documentLogo} alt={t.brand} className="doc-logo" />
        </Link>
        <nav className="doc-links" aria-label={t.menu}>
          <Link href="/">{t.menu}</Link>
          <Link href="/contact">{t.contact}</Link>
          <Link href="/privacy">{t.privacy}</Link>
          <Link href="/terms">{t.terms}</Link>
          <LangButton tone="light" />
        </nav>
      </header>
      <main id="main" className="doc-main">
        <h1 className="doc-h1">{title}</h1>
        <div className="prose">{children}</div>
      </main>
      <footer className="doc-foot">
        <p>
          {t.brand} · {t.address}
        </p>
        <p>
          {t.whatsapp}{" "}
          <a href={`https://wa.me/${SITE.whatsappE164}`}>{SITE.whatsappDisplay}</a>
          {" · "}
          <a href={SITE.instagram}>{SITE.instagramHandle}</a>
        </p>
        <p>
          <Link href="/privacy">{t.privacy}</Link>
          {" · "}
          <Link href="/terms">{t.terms}</Link>
          {" · "}
          <Link href="/contact">{t.contact}</Link>
        </p>
      </footer>
    </div>
  );
}
