import type { z } from "zod";
type Issue = z.core.$ZodIssue;
// Zod's built-in messages are written for developers ("Too small: expected
// string to have >=1 characters"). Schema-specific messages pass through.
function plain(i: Issue): string {
  if (!/^(Too small|Too big|Invalid)/.test(i.message)) return i.message;
  if (i.code === "invalid_type")
    return i.expected === "number" ? "Enter a number." : "Required.";
  if (i.code === "too_small") {
    const n = Number(i.minimum);
    if (i.origin === "string")
      return n <= 1 ? "Required." : `Use at least ${n} characters.`;
    if (i.origin === "array" || i.origin === "set") return `Add at least ${n}.`;
    return `Use ${n} or more.`;
  }
  if (i.code === "too_big") {
    const n = Number(i.maximum);
    if (i.origin === "string") return `Keep it to ${n} characters or fewer.`;
    if (i.origin === "array" || i.origin === "set") return `Use at most ${n}.`;
    return `Use ${n} or less.`;
  }
  if (i.code === "invalid_format" && i.format === "url")
    return "Enter a full web address, starting with https://.";
  return "Check this value.";
}
// One message per field, keyed by its dotted path ("kind.sauces.0.name").
export function fieldErrors(issues: readonly Issue[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) out[i.path.join(".")] ??= plain(i);
  return out;
}
