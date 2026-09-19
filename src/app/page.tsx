import type { Metadata } from "next";
import { MenuFeed } from "@/components/MenuFeed";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Menu",
  description: `${SITE.tagline}. Browse Sushinaa rolls, starters, bowls, and boxes. Prices in QAR update when you change protein, pieces, or sauce. Add to ticket — no payment on this page.`,
  alternates: { canonical: SITE.url },
};

export default function Home() {
  return (
    <div className="app-lock">
      <MenuFeed />
    </div>
  );
}
