import type { Lang } from "./localize";

type TextKey =
  | "eachOne" | "langButton" | "langButtonLabel" | "brand" | "whatsapp" | "tapForDetails" | "skip"
  | "viewOrder" | "addToOrder" | "added" | "from" | "close" | "closeDetails" | "closeTicket" | "clear"
  | "total" | "comment" | "commentPlaceholder" | "sendWhatsApp" | "openingWhatsApp" | "emptyTicket"
  | "yourTicket" | "noMatch" | "clearFilters" | "swipeUp" | "fewer" | "more" | "menu" | "contact"
  | "privacy" | "terms" | "backToMenu" | "filters" | "category" | "searchMenu" | "clearSearch"
  | "viewOnlyNotice" | "dietary" | "menuFeed" | "loading" | "spicy" | "regular" | "veg" | "seafood"
  | "all" | "dip" | "pcs" | "proteinPieces" | "sauceChanges" | "spicyOrRegular" | "pickStarterSushi"
  | "pickStarter" | "addonsAvailable" | "newOnMenu" | "pickTwoSauces" | "saucesIncluded" | "sizeFlavour"
  | "or" | "pick" | "contactTitle" | "contactFrom" | "contactLead" | "name" | "phone" | "message"
  | "enterName" | "enterPhone" | "tellMore" | "thankTitle" | "thankBody" | "missingTitle" | "missingBody"
  | "ticketWord" | "commentWord" | "privacyTitle" | "termsTitle" | "updated" | "termsUpdated" | "company"
  | "menuBlurb" | "privacyBlurb" | "termsBlurb" | "contactBlurb" | "thankBlurb" | "missingBlurb" | "address";

export type Copy = Record<TextKey, string> & {
  openDetails: (name: string) => string;
  ofCount: (n: number, max: number) => string;
  openOrder: (n: number) => string;
  inOrder: (n: number) => string;
  searchResults: (n: number) => string;
  itemNumber: (n: number) => string;
  fewerOf: (name: string) => string;
  moreOf: (name: string) => string;
  oneFewer: (name: string) => string;
  oneMore: (name: string) => string;
  piecesHint: (list: string) => string;
};

export function strings(lang: Lang, copy: Record<Lang, Record<string, string>>): Copy {
  const t = copy[lang];
  const format = (key: string, ...args: (string | number)[]) =>
    t[key].replace(/\{(\d+)\}/g, (_, i) => String(args[Number(i)] ?? ""));
  const plural = (key: string, n: number) => format(key + (n === 0 ? "Zero" : n === 1 ? "One" : "Other"), n);
  return {
    ...t,
    openDetails: (s: string) => format("openDetails", s),
    ofCount: (n: number, m: number) => format("ofCount", n, m),
    openOrder: (n: number) => plural("openOrder", n),
    inOrder: (n: number) => plural("inOrder", n),
    searchResults: (n: number) => format(n === 1 ? "searchResultsOne" : "searchResultsOther", n),
    itemNumber: (n: number) => format("itemNumber", n),
    fewerOf: (s: string) => format("fewerOf", s),
    moreOf: (s: string) => format("moreOf", s),
    oneFewer: (s: string) => format("oneFewer", s),
    oneMore: (s: string) => format("oneMore", s),
    piecesHint: (s: string) => format("piecesHint", s),
  } as Copy;
}
