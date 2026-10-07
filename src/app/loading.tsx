import { getMenu } from "@/cms/repository";
import { strings } from "@/i18n/copy";
import { requestLang } from "@/i18n/request-lang";

export default async function Loading() {
  const {menu}=await getMenu();
  const SITE=menu.settings;
  const lang = await requestLang();
  return (
    <div className="boot" role="status" aria-live="polite">
      <img src={SITE.logo} alt="" className="boot-logo" />
      <p>{strings(lang,menu.copy).loading}</p>
    </div>
  );
}
