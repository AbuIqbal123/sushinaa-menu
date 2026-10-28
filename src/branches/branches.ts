// The four branches. Hard-coded until branch details move into the CMS.
// Hours are minutes from midnight of the opening day. A close above 1440
// runs past midnight into the next day. Day index: 0 = Sunday … 6 = Saturday.

export type Session = { open: number; close: number };
export type WeekHours = readonly Session[];
export type Nigiri = "salmon" | "tuna" | "ebi" | "tamago";
export type BranchId = 'down-town' | 'al-thumama' | 'west-bay' | 'al-khor';
export type Branch = { slug: BranchId; code: string; nameAr: string; mapsUrl: string; coordinates: [number, number]; name: string; nigiri: Nigiri; hours: WeekHours };

const at = (h: number, m = 0) => h * 60 + m;
const FRI = 5;

function week(open: number, close: number, except: Record<number, Session> = {}): WeekHours {
  return Array.from({ length: 7 }, (_, day) => except[day] ?? { open, close });
}

export const BRANCHES: readonly Branch[] = [
  {
    slug: "down-town", code: "01", nameAr: "داون تاون", mapsUrl: "https://maps.app.goo.gl/ewbskv1D8Dhts5bHA", coordinates: [51.4335831, 25.2671162], name: "Down Town", nigiri: "salmon",
    hours: week(at(12), at(26, 30), { [FRI]: { open: at(13), close: at(26, 30) } }),
  },
  {
    slug: "al-thumama", code: "02", nameAr: "الثمامة", mapsUrl: "https://maps.app.goo.gl/ieuqXoY19PY4jxd98", coordinates: [51.5422826, 25.2208925], name: "Al-Thumama", nigiri: "tuna",
    hours: week(at(12), at(27), { [FRI]: { open: at(13), close: at(27) } }),
  },
  { slug: "west-bay", code: "03", nameAr: "الخليج الغربي", mapsUrl: "https://maps.app.goo.gl/z8PsE8tnStUqso9u6", coordinates: [51.5207116, 25.3184753], name: "West Bay", nigiri: "ebi", hours: week(at(14), at(23)) },
  {
    slug: "al-khor", code: "04", nameAr: "الخور", mapsUrl: "https://maps.app.goo.gl/NGA7dkWQK1QYhRQ38", coordinates: [51.4956563, 25.6877076], name: "Al-Khor", nigiri: "tamago",
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
