import type { Metadata } from "next";
import { strings, type Copy } from "./copy";
import { requestLang } from "./request-lang";
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
