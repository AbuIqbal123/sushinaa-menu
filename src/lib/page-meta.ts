import type { Metadata } from "next";
import { strings, type Copy } from "@/i18n/copy";
import { requestLang } from "@/i18n/request-lang";
import { SITE } from "./site";

export async function pageMeta(
  title: (t: Copy) => string,
  description: (t: Copy) => string,
  path?: string,
): Promise<Metadata> {
  const t = strings(await requestLang());
  return {
    title: title(t),
    description: description(t),
    ...(path === undefined
      ? {}
      : { alternates: { canonical: path ? `${SITE.url}${path}` : SITE.url } }),
  };
}
