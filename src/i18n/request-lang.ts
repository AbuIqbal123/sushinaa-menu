import { cookies } from "next/headers";
import type { Lang } from "./localize";

export async function requestLang(): Promise<Lang> {
  const jar = await cookies();
  return jar.get("sushina-lang")?.value === "ar" ? "ar" : "en";
}
