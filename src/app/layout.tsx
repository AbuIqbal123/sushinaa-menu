import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/next";
import { cookies } from "next/headers";
import { LocaleProvider, SkipLink } from "@/lib/locale";
import type { Lang } from "@/lib/localize";
import { SITE } from "@/lib/site";
import "./globals.css";

const display = localFont({
  src: [
    { path: "../../public/fonts/KautivaProC-Regular.otf", weight: "400", style: "normal" },
    { path: "../../public/fonts/KautivaProC-Bold.otf", weight: "700", style: "normal" },
  ],
  variable: "--font-display",
  display: "swap",
  preload: true,
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

const sans = localFont({
  src: [
    { path: "../../public/fonts/ZenKakuGothicAntique-Regular.ttf", weight: "400" },
    { path: "../../public/fonts/ZenKakuGothicAntique-Medium.ttf", weight: "500" },
    { path: "../../public/fonts/ZenKakuGothicAntique-Bold.ttf", weight: "700" },
  ],
  variable: "--font-sans",
  display: "swap",
  preload: true,
  fallback: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
});

const arabic = localFont({
  src: [{ path: "../../public/fonts/ArbFONTS-Greta-Arabic-Medium.ttf", weight: "500" }],
  variable: "--font-arabic",
  display: "swap",
  fallback: ["Tahoma", "Arial", "sans-serif"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} · QR menu`,
    template: `%s · ${SITE.name}`,
  },
  description: `${SITE.tagline}. Sushinaa QR menu in Qatar — pick protein, pieces, and sauces. Add to your ticket and send on WhatsApp ${SITE.whatsappDisplay}.`,
  applicationName: SITE.name,
  keywords: ["Sushinaa", "sushi Qatar", "Doha sushi", "QR menu", "سوشينا"],
  authors: [{ name: SITE.name }],
  creator: SITE.name,
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
  openGraph: {
    type: "website",
    locale: "en_QA",
    url: SITE.url,
    siteName: SITE.name,
    title: `${SITE.name} · QR menu`,
    description: `${SITE.tagline}. Order sushi in Qatar from the QR menu — no payment on this page.`,
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: `${SITE.name} QR menu` }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.name} · QR menu`,
    description: `${SITE.tagline}. Sushi QR menu for Qatar.`,
    images: ["/og.jpg"],
  },
  robots: { index: true, follow: true },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: SITE.name,
  },
  alternates: { canonical: SITE.url },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#14110F",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const lang: Lang = jar.get("sushina-lang")?.value === "ar" ? "ar" : "en";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: SITE.name,
    alternateName: SITE.nameAr,
    slogan: SITE.tagline,
    url: SITE.url,
    telephone: `+${SITE.whatsappE164}`,
    areaServed: SITE.areas.map((a) => ({ "@type": "City", name: `${a}, Qatar` })),
    address: {
      "@type": "PostalAddress",
      addressLocality: "Doha",
      addressCountry: "QA",
    },
    servesCuisine: ["Sushi", "Japanese", "Qatari"],
    priceRange: "$$",
    sameAs: [SITE.instagram],
  };

  return (
    <html
      lang={lang}
      dir={lang === "ar" ? "rtl" : "ltr"}
      className={`${display.variable} ${sans.variable} ${arabic.variable} h-full`}
    >
      <body className="min-h-full antialiased">
        <LocaleProvider initial={lang}>
          <SkipLink />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
          {children}
          <Analytics />
        </LocaleProvider>
      </body>
    </html>
  );
}
