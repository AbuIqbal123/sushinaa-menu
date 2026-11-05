const ZONE = 'Asia/Qatar';

function qatarParts(at: Date | string | number) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    hourCycle: 'h12',
  }).formatToParts(new Date(at));
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return {
    day: pick('day'),
    month: pick('month'),
    year: pick('year'),
    hour: pick('hour'),
    minute: pick('minute'),
    dayPeriod: pick('dayPeriod').toLowerCase(),
  };
}

/** Calendar day in Qatar: dd-mm-yyyy */
export function formatQatarDate(at: Date | string | number) {
  const { day, month, year } = qatarParts(at);
  return `${day}-${month}-${year}`;
}

/** Date and time in Qatar: dd-mm-yyyy h:mm am/pm */
export function formatQatarDateTime(at: Date | string | number) {
  const { day, month, year, hour, minute, dayPeriod } = qatarParts(at);
  return `${day}-${month}-${year} ${hour}:${minute} ${dayPeriod}`;
}
