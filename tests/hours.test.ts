import { test } from "node:test";
import assert from "node:assert/strict";
import { BRANCHES, findBranch, type Branch } from "../src/branches/branches";
import { accessibleName, branchStatus, qatarClock } from "../src/branches/hours";

const SUN = 0, WED = 3, THU = 4, FRI = 5, SAT = 6;
const branch = (slug: string): Branch => {
  const b = findBranch(slug);
  assert.ok(b, slug);
  return b;
};
const at = (slug: string, day: number, h: number, m = 0) => branchStatus(branch(slug).hours, { day, minute: h * 60 + m });

test("four branches with unique slugs and seven days of hours", () => {
  assert.deepEqual(BRANCHES.map((b) => b.slug), ["down-town", "al-thumama", "west-bay", "al-khor"]);
  for (const b of BRANCHES) assert.equal(b.hours.length, 7, b.slug);
  assert.equal(findBranch("nope"), undefined);
});

test("Fri 01:00 Down Town is still open from Thursday night", () => {
  const s = at("down-town", FRI, 1);
  assert.equal(s.open, true);
  assert.equal(s.label, "Open now");
  assert.equal(s.hours, "12pm\u2009\u2013\u20092:30am");
});

test("Fri 12:30 Down Town opens at 1pm", () => {
  const s = at("down-town", FRI, 12, 30);
  assert.equal(s.open, false);
  assert.equal(s.label, "Opens 1pm");
  assert.equal(s.hours, "1pm\u2009\u2013\u20092:30am");
});

test("Al-Thumama at 02:45 closes in 15 min", () => {
  const s = at("al-thumama", WED, 2, 45);
  assert.equal(s.open, true);
  assert.equal(s.soon, true);
  assert.equal(s.label, "Closes in 15 min");
});

test("West Bay at 23:00 is closed and shows tomorrow's hours", () => {
  const s = at("west-bay", THU, 23);
  assert.equal(s.open, false);
  assert.equal(s.tomorrow, true);
  assert.equal(s.label, "Opens tomorrow");
  assert.equal(s.hours, "2pm\u2009\u2013\u200911pm");
  assert.equal(accessibleName("West Bay", s), "West Bay, opens tomorrow, tomorrow 2pm to 11pm");
});

test("Al-Khor Sat 00:15 is open from Friday's late session", () => {
  const s = at("al-khor", SAT, 0, 15);
  assert.equal(s.open, true);
  assert.equal(s.label, "Closes in 15 min");
});

test("Al-Khor Wed 23:00 is closed; tomorrow is a late night", () => {
  const s = at("al-khor", WED, 23);
  assert.equal(s.open, false);
  assert.equal(s.label, "Opens tomorrow");
  assert.equal(s.hours, "1:30pm\u2009\u2013\u200912:30am");
});

test("Al-Khor Thu 00:15 is closed: Wednesday ends at 10:30pm", () => {
  const s = at("al-khor", THU, 0, 15);
  assert.equal(s.open, false);
  assert.equal(s.label, "Opens 1:30pm");
});

test("the week wraps: Saturday reads Friday's spillover, Sunday reads Saturday's", () => {
  const dt = at("down-town", SAT, 1);
  assert.equal(dt.open, true);
  assert.equal(dt.hours, "1pm\u2009\u2013\u20092:30am");
  assert.equal(at("al-khor", SUN, 0, 15).open, true);
  assert.equal(at("al-khor", SUN, 0, 30).open, false);
  const wb = at("west-bay", SAT, 23, 30);
  assert.equal(wb.tomorrow, true);
  assert.equal(wb.hours, "2pm\u2009\u2013\u200911pm");
});

test("a UTC instant is read on the Qatar day", () => {
  // Thursday 22:00 UTC is Friday 01:00 in Qatar (UTC+3).
  const clock = qatarClock(new Date("2026-10-22T22:00:00Z"));
  assert.deepEqual(clock, { day: FRI, minute: 60 });
  assert.equal(branchStatus(branch("down-town").hours, clock).label, "Open now");
  assert.deepEqual(qatarClock(new Date("2026-10-24T20:59:00Z")), { day: SAT, minute: 23 * 60 + 59 });
});

test("the accessible name reads status and hours", () => {
  assert.equal(accessibleName("Down Town", at("down-town", WED, 15)), "Down Town, open now, today 12pm to 2:30am");
});
