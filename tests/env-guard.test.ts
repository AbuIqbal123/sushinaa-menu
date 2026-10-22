import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { guardProblems } from "../src/cms/env-guard";
import { LIVE_DATABASE_HOST } from "../src/lib/deploy-env";

const live = `libsql://${LIVE_DATABASE_HOST}`;

test("report and enforce agree on what is safe", () => {
  assert.deepEqual(
    guardProblems({
      production: true,
      databaseUrl: live,
      paymentProvider: undefined,
      marker: null,
    }),
    [],
  );
  assert.deepEqual(
    guardProblems({
      production: true,
      databaseUrl: "file:./data/menu.db",
      paymentProvider: "mock",
      marker: null,
    }),
    [
      "Production must use the live database hostname.",
      "Production must not use a mock payment provider.",
    ],
  );
  assert.deepEqual(
    guardProblems({
      production: false,
      databaseUrl: live,
      paymentProvider: "mock",
      marker: "development",
    }),
    ["Non-production must not use the live database hostname."],
  );
  assert.deepEqual(
    guardProblems({
      production: false,
      databaseUrl: "libsql://sushinaa-cms-dev.aws-ap-south-1.turso.io",
      paymentProvider: "mock",
      marker: "development",
    }),
    [],
  );
  assert.deepEqual(
    guardProblems({
      production: false,
      databaseUrl: "file:/tmp/menu.db",
      paymentProvider: undefined,
      marker: null,
    }),
    ["Non-production must have the development marker."],
  );
});

function boot(mode: string) {
  const dir = mkdtempSync(join(tmpdir(), "sushinaa-guard-"));
  return spawnSync(
    "npx",
    [
      "tsx",
      "--eval",
      "import { initDb } from './src/cms/db.ts'; initDb().then(() => process.exit(0), (error) => { process.stderr.write(String(error) + '\\n'); process.exit(1); });",
    ],
    {
      encoding: "utf8",
      cwd: process.cwd(),
      env: {
        ...process.env,
        CMS_ENV_GUARD: mode,
        CMS_DATABASE_URL: `file:${dir}/menu.db`,
        CMS_DATABASE_AUTH_TOKEN: "",
        VERCEL: "",
        VERCEL_ENV: "",
        PAYMENT_PROVIDER: "",
      },
    },
  );
}

test("initDb logs and continues in report mode, and refuses in enforce mode", () => {
  const report = boot("report");
  assert.equal(report.status, 0, report.stderr);
  assert.match(report.stderr, /cms-env-guard report: Non-production must have the development marker/);

  const enforce = boot("enforce");
  assert.notEqual(enforce.status, 0);
  assert.match(enforce.stderr, /cms-env-guard: Non-production must have the development marker/);
});
