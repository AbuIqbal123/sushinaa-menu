import { defineConfig } from "@playwright/test";
import { randomUUID } from "node:crypto";

// A throwaway admin account for this run. Workers inherit process.env, so the
// specs (via tests/browser/admin.ts) and the server below share the values.
process.env.CMS_ADMIN_USERNAME ||= "e2e-admin";
process.env.CMS_ADMIN_PASSWORD ||= randomUUID();
// Set CMS_TEST_URL (and the CMS_ADMIN_* values it uses) to test a server you started.
const external = process.env.CMS_TEST_URL;
const port = 3006;

export default defineConfig({
  testDir: "./tests/browser",
  workers: 1,
  use: {
    baseURL: external || `http://localhost:${port}`,
    trace: "retain-on-failure",
    actionTimeout: 10000,
  },
  timeout: 60000,
  // Serves the last `npm run build`.
  webServer: external
    ? undefined
    : {
        command: `npx next start -p ${port}`,
        url: `http://localhost:${port}`,
        reuseExistingServer: false,
        env: {
          CMS_ADMIN_USERNAME: process.env.CMS_ADMIN_USERNAME,
          CMS_ADMIN_PASSWORD: process.env.CMS_ADMIN_PASSWORD,
        },
      },
});
