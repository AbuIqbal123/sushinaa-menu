import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: "private key", pattern: /-----BEGIN (?:RSA |OPENSSH )?PRIVATE KEY-----/ },
  { name: "aws access key", pattern: /AKIA[0-9A-Z]{16}/ },
  { name: "live stripe key", pattern: /sk_live_[0-9A-Za-z]{16,}/ },
  { name: "github token", pattern: /gh[pousr]_[0-9A-Za-z]{20,}/ },
  { name: "libsql credential", pattern: /libsql:\/\/[^/\s"'`]*@/ },
  { name: "jwt", pattern: /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { name: "assigned database token", pattern: /(?:AUTH_TOKEN|SECRET|PASSWORD)\s*=\s*['"][^'"]{12,}['"]/ },
];

const TEXT = /\.(?:ts|tsx|js|mjs|cjs|json|md|yml|yaml|css|sql|toml|txt|html|example)$/;

export function secretHits(file: string, text: string): string[] {
  if (!TEXT.test(file) || file === ".env.example") return [];
  return PATTERNS.flatMap(({ name, pattern }) => (pattern.test(text) ? [`${file}: ${name}`] : []));
}

export function scanFiles(files: { name: string; text: string }[]) {
  return files.flatMap((file) => secretHits(file.name, file.text));
}

function trackedFiles() {
  const out = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" });
  return out.split("\0").filter(Boolean);
}

const invoked = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"));
if (invoked) {
  const hits = scanFiles(
    trackedFiles()
      .filter((name) => TEXT.test(name))
      .map((name) => ({
        name,
        text: readFileSync(name, "utf8"),
      })),
  );
  if (hits.length) {
    process.stderr.write(`${hits.join("\n")}\n`);
    process.exitCode = 1;
  }
}
