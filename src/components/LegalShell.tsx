import Link from "next/link";
import { SITE } from "@/lib/site";

export function LegalShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="doc-page">
      <header className="doc-nav">
        <Link href="/" className="doc-brand">
          <img src="/brand/logotype-red.svg" alt={SITE.name} className="doc-logo" />
        </Link>
        <nav className="doc-links" aria-label="Site">
          <Link href="/">Menu</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </nav>
      </header>
      <main id="main" className="doc-main">
        <h1 className="doc-h1">{title}</h1>
        <div className="prose">{children}</div>
      </main>
      <footer className="doc-foot">
        <p>
          {SITE.name} · {SITE.addressLine}
        </p>
        <p>
          WhatsApp{" "}
          <a href={`https://wa.me/${SITE.whatsappE164}`}>{SITE.whatsappDisplay}</a>
          {" · "}
          <a href={SITE.instagram}>{SITE.instagramHandle}</a>
        </p>
        <p>
          <Link href="/privacy">Privacy</Link>
          {" · "}
          <Link href="/terms">Terms</Link>
          {" · "}
          <Link href="/contact">Contact</Link>
        </p>
      </footer>
    </div>
  );
}
