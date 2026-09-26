import { cookies } from "next/headers";

export default async function Loading() {
  const jar = await cookies();
  const ar = jar.get("sushina-lang")?.value === "ar";
  return (
    <div className="boot" role="status" aria-live="polite">
      <img src="/brand/logotype-white.svg" alt="" className="boot-logo" />
      <p>{ar ? "جارٍ تحميل القائمة…" : "Loading the menu…"}</p>
    </div>
  );
}
