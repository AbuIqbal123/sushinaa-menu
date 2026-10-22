export type BranchId = 'down-town' | 'al-thumama' | 'west-bay' | 'al-khor';
export type Branch = { id: BranchId; name: string; nameAr: string; coordinates: [longitude: number, latitude: number]; hours: (day: number) => [number, number] };
// Minutes after midnight. Closing times > 1440 belong to the following day.
// Area-level map positions, pending exact storefront pins from the restaurant.
export const branches: Branch[] = [
  { id: 'down-town', name: 'Down Town', nameAr: 'داون تاون', coordinates: [51.442, 25.265], hours: day => [day === 5 ? 780 : 720, 1590] },
  { id: 'al-thumama', name: 'Al-Thumama', nameAr: 'الثمامة', coordinates: [51.56147, 25.23494], hours: day => [day === 5 ? 780 : 720, 1620] },
  { id: 'west-bay', name: 'West Bay', nameAr: 'الخليج الغربي', coordinates: [51.53282, 25.32197], hours: () => [840, 1380] },
  { id: 'al-khor', name: 'Al-Khor', nameAr: 'الخور', coordinates: [51.50583, 25.68389], hours: day => [810, [4, 5, 6].includes(day) ? 1470 : 1350] },
];
const qatar = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Qatar', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
export function branchStatus(branch: Branch, now: Date) {
  const parts = Object.fromEntries(qatar.formatToParts(now).map(p => [p.type, p.value]));
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
  const minute = Number(parts.hour) * 60 + Number(parts.minute);
  const today = branch.hours(day);
  const yesterday = branch.hours((day + 6) % 7);
  const overnight = yesterday[1] > 1440 && minute < yesterday[1] - 1440;
  const open = overnight || (minute >= today[0] && minute < today[1]);
  return { open, hours: overnight ? yesterday : today, nextOpen: today[0], nextDay: !open && minute >= today[1] };
}
export function timeLabel(minutes: number, lang: 'en' | 'ar') {
  const h = Math.floor(minutes / 60) % 24;
  return `${h % 12 || 12}:${String(minutes % 60).padStart(2, '0')} ${lang === 'ar' ? (h < 12 ? 'ص' : 'م') : (h < 12 ? 'AM' : 'PM')}`;
}
