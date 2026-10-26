import { getMenu } from "@/cms/repository";
import type { MetadataRoute } from "next";
import { strings } from "@/i18n/copy";
import { requestLang } from "@/i18n/request-lang";

export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { menu } = await getMenu();
  const lang = await requestLang();
  const t = strings(lang, menu.copy);
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
