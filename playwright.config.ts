import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  workers: 1,
  use: {
    baseURL: process.env.CMS_TEST_URL || "http://localhost:3005",
    trace: "retain-on-failure",
    actionTimeout: 10000,
  },
  timeout: 60000,
});
