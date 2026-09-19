import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const display = localFont({
  src: [
    { path: "../../public/fonts/KautivaProC-Regular.otf", weight: "400", style: "normal" },
    { path: "../../public/fonts/KautivaProC-Bold.otf", weight: "700", style: "normal" },
  ],
  variable: "--font-display",
  display: "swap",
  preload: true,
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
});

const arabic = localFont({
  src: [{ path: "../../public/fonts/ArbFONTS-Greta-Arabic-Medium.ttf", weight: "500" }],
  variable: "--font-arabic",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sushinaa — menu",
  description:
    "Let the good times roll. Sushinaa QR menu — pick your protein, pieces, and sauces. Add to ticket, then show it at the counter.",
  applicationName: "Sushinaa",
  icons: { icon: "/brand/logo-red.svg" },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Sushinaa",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#14110F",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${arabic.variable} h-full`}
    >
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
