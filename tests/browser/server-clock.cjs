// Playwright's local server only. No application code or deployed environment uses this clock.
// Keep real elapsed time so ordering, rate windows and polling remain realistic.
const NativeDate = Date;
const offset = NativeDate.parse('2026-10-23T15:00:00+03:00') - NativeDate.now();
global.Date = class extends NativeDate {
  constructor(...args) { if (args.length) super(...args); else super(NativeDate.now() + offset); }
  static parse(value) { return NativeDate.parse(value); }
  static UTC(...args) { return NativeDate.UTC(...args); }
  static now() { return NativeDate.now() + offset; }
};
