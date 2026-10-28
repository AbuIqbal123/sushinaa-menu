// Live opening status for a branch, in Asia/Qatar time. Pure: callers pass the instant.
import type { Lang } from "@/i18n/localize";
import type { Session, WeekHours } from "./branches";

export type QatarClock = { day: number; minute: number };

export type BranchStatus = {
  open: boolean;
  /** Open, but closing within 30 minutes. */
  soon: boolean;
  /** "Open now", "Closes in 15 min", "Opens 1:30pm" or "Opens tomorrow". */
  label: string;
  /** The session the label is about, like "12pm – 2:30am". */
  hours: string;
  /** True when `hours` are tomorrow's. */
  tomorrow: boolean;
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SOON = 30;

const qatar = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Qatar", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

export function qatarClock(at: Date): QatarClock {
  const parts = qatar.formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { day: DAYS.indexOf(get("weekday")), minute: Number(get("hour")) * 60 + Number(get("minute")) };
}

export function formatMinute(minute: number, lang: Lang = "en"): string {
  const m = ((minute % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const mins = m % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  if (lang === "ar") {
    const digits = (n: number) => new Intl.NumberFormat("ar-QA", { useGrouping: false }).format(n);
    return `${digits(h12)}${mins ? `:${digits(mins).padStart(2, "٠")}` : ""} ${h24 < 12 ? "ص" : "م"}`;
  }
  return `${h12}${mins ? `:${String(mins).padStart(2, "0")}` : ""}${h24 < 12 ? "am" : "pm"}`;
}

export const RANGE_DASH = "\u2009\u2013\u2009";
const range = (s: Session, lang: Lang) => `${formatMinute(s.open, lang)}${RANGE_DASH}${formatMinute(s.close, lang)}`;

function openFor(session: Session, left: number, lang: Lang): BranchStatus {
  const soon = left <= SOON;
  const label = lang === "ar" ? (soon ? `يغلق خلال ${new Intl.NumberFormat("ar-QA").format(left)} دقيقة` : "مفتوح الآن")
    : soon ? `Closes in ${left} min` : "Open now";
  return { open: true, soon, label, hours: range(session, lang), tomorrow: false };
}

export function branchStatus(hours: WeekHours, { day, minute }: QatarClock, lang: Lang = "en"): BranchStatus {
  const yesterday = hours[(day + 6) % 7];
  const today = hours[day];
  // Still inside last night's session, past midnight.
  if (yesterday.close > 1440 && minute < yesterday.close - 1440) {
    return openFor(yesterday, yesterday.close - 1440 - minute, lang);
  }
  if (minute >= today.open && minute < today.close) return openFor(today, today.close - minute, lang);
  if (minute < today.open) {
    return { open: false, soon: false, label: lang === "ar" ? `يفتح ${formatMinute(today.open, lang)}` : `Opens ${formatMinute(today.open)}`, hours: range(today, lang), tomorrow: false };
  }
  // Today's session is over, so tomorrow's hours are the useful ones.
  return { open: false, soon: false, label: lang === "ar" ? "يفتح غدًا" : "Opens tomorrow", hours: range(hours[(day + 1) % 7], lang), tomorrow: true };
}

/** "Down Town, open now, today 12pm to 2:30am". */
export function accessibleName(name: string, status: BranchStatus, lang: Lang = "en"): string {
  if (lang === "ar") return `${name}، ${status.label}، ${status.tomorrow ? "غدًا" : "اليوم"} ${status.hours.replace(RANGE_DASH, " إلى ")}`;
  const label = status.label.charAt(0).toLowerCase() + status.label.slice(1);
  const when = status.tomorrow ? "tomorrow" : "today";
  return `${name}, ${label}, ${when} ${status.hours.replace(RANGE_DASH, " to ")}`;
}
