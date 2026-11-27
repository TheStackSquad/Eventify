// frontend/playwright.config.mjs

import { defineConfig, devices } from "@playwright/test";
import { STATE_PATH } from "./e2e/global-setup.mjs";

// The rig backend allows the frontend origin http://localhost:3000 (FRONTEND_BASE_URL),
// so keep this port. Stop any `npm run dev` on 3000 first: the suite runs a production build.
const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3000";

const phone = (name, width, height) => ({
  name,
  use: {
    ...devices["Pixel 7"],
    viewport: { width, height },
    screen: { width, height },
  },
});
const desktop = (name, width, height) => ({
  name,
  use: { ...devices["Desktop Chrome"], viewport: { width, height } },
});

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.mjs",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  workers: 1, // one shared test user: parallel token refreshes would race
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    storageState: STATE_PATH,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    phone("phone-360x640", 360, 640),
    phone("phone-375x667", 375, 667),
    phone("phone-412x915", 412, 915),
    phone("phone-landscape-844x390", 844, 390),
    phone("tablet-768x1024", 768, 1024),
    desktop("desktop-1280x800", 1280, 800),
    desktop("desktop-1440x900", 1440, 900),
  ],
  webServer: {
    command: "npm run build && npx next start -p 3000",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: { NEXT_PUBLIC_RQ_DEVTOOLS: "0" }, // no devtools button floating over the form
  },
});
