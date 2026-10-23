import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const FORBIDDEN = /\b(DROP|RENAME)\b/i;

export function migrationViolations(sql: string): string[] {
  return sql.split(/\r?\n/).flatMap((line, index) =>
    FORBIDDEN.test(line) ? [`line ${index + 1}: ${line.trim()}`] : [],
  );
}

export function checkMigrationDir(dir: string) {
  const files = readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  const failures: string[] = [];
  for (const name of files) {
    const hits = migrationViolations(readFileSync(join(dir, name), "utf8"));
    for (const hit of hits) failures.push(`${name}: ${hit}`);
  }
  return failures;
}

const invoked = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"));
if (invoked) {
  const failures = checkMigrationDir(join(process.cwd(), "db/migrations"));
  if (failures.length) {
    process.stderr.write(`${failures.join("\n")}\n`);
    process.exitCode = 1;
  }
}
