// Live opening status for a branch, in Asia/Qatar time. Pure: callers pass the instant.
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

export function formatMinute(minute: number): string {
  const m = ((minute % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const mins = m % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}${mins ? `:${String(mins).padStart(2, "0")}` : ""}${h24 < 12 ? "am" : "pm"}`;
}

export const RANGE_DASH = "\u2009\u2013\u2009";
const range = (s: Session) => `${formatMinute(s.open)}${RANGE_DASH}${formatMinute(s.close)}`;

function openFor(session: Session, left: number): BranchStatus {
  const soon = left <= SOON;
  return { open: true, soon, label: soon ? `Closes in ${left} min` : "Open now", hours: range(session), tomorrow: false };
}

export function branchStatus(hours: WeekHours, { day, minute }: QatarClock): BranchStatus {
  const yesterday = hours[(day + 6) % 7];
  const today = hours[day];
  // Still inside last night's session, past midnight.
  if (yesterday.close > 1440 && minute < yesterday.close - 1440) {
    return openFor(yesterday, yesterday.close - 1440 - minute);
  }
  if (minute >= today.open && minute < today.close) return openFor(today, today.close - minute);
  if (minute < today.open) {
    return { open: false, soon: false, label: `Opens ${formatMinute(today.open)}`, hours: range(today), tomorrow: false };
  }
  // Today's session is over, so tomorrow's hours are the useful ones.
  return { open: false, soon: false, label: "Opens tomorrow", hours: range(hours[(day + 1) % 7]), tomorrow: true };
}

/** "Down Town, open now, today 12pm to 2:30am". */
export function accessibleName(name: string, status: BranchStatus): string {
  const label = status.label.charAt(0).toLowerCase() + status.label.slice(1);
  const when = status.tomorrow ? "tomorrow" : "today";
  return `${name}, ${label}, ${when} ${status.hours.replace(RANGE_DASH, " to ")}`;
}
