// The four branches. Hard-coded until branch details move into the CMS.
// Hours are minutes from midnight of the opening day. A close above 1440
// runs past midnight into the next day. Day index: 0 = Sunday … 6 = Saturday.

export type Session = { open: number; close: number };
export type WeekHours = readonly Session[];
export type Nigiri = "salmon" | "tuna" | "ebi" | "tamago";
export type Branch = { slug: string; name: string; nigiri: Nigiri; hours: WeekHours };

export const BRANCH_COOKIE = "sushina-branch";

const at = (h: number, m = 0) => h * 60 + m;
const FRI = 5;

function week(open: number, close: number, except: Record<number, Session> = {}): WeekHours {
  return Array.from({ length: 7 }, (_, day) => except[day] ?? { open, close });
}

export const BRANCHES: readonly Branch[] = [
  {
    slug: "down-town", name: "Down Town", nigiri: "salmon",
    hours: week(at(12), at(26, 30), { [FRI]: { open: at(13), close: at(26, 30) } }),
  },
  {
    slug: "al-thumama", name: "Al-Thumama", nigiri: "tuna",
    hours: week(at(12), at(27), { [FRI]: { open: at(13), close: at(27) } }),
  },
  { slug: "west-bay", name: "West Bay", nigiri: "ebi", hours: week(at(14), at(23)) },
  {
    slug: "al-khor", name: "Al-Khor", nigiri: "tamago",
    // Sun–Wed until 10:30pm; Thu, Fri and Sat until 12:30am.
    hours: week(at(13, 30), at(22, 30), {
      4: { open: at(13, 30), close: at(24, 30) },
      5: { open: at(13, 30), close: at(24, 30) },
      6: { open: at(13, 30), close: at(24, 30) },
    }),
  },
];

export function findBranch(slug: string | undefined): Branch | undefined {
  return BRANCHES.find((b) => b.slug === slug);
}
