import type { MetadataRoute } from "next";
import { strings } from "@/lib/copy";
import { requestLang } from "@/lib/request-lang";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const lang = await requestLang();
  const t = strings(lang);
  const ar = lang === "ar";
  return {
    name: ar ? "قائمة سوشينا" : "Sushinaa menu",
    short_name: t.brand,
    description: ar ? "قائمة سوشينا في قطر." : "Let the good times roll. QR menu for Sushinaa in Qatar.",
    start_url: "/",
    display: "standalone",
    background_color: "#14110F",
    theme_color: "#14110F",
    icons: [
      { src: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      { src: "/favicon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
