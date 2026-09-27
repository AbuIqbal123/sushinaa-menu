import { strings } from "@/i18n/copy";
import { requestLang } from "@/i18n/request-lang";

export default async function Loading() {
  const lang = await requestLang();
  return (
    <div className="boot" role="status" aria-live="polite">
      <img src="/brand/logotype-white.svg" alt="" className="boot-logo" />
      <p>{strings(lang).loading}</p>
    </div>
  );
}
