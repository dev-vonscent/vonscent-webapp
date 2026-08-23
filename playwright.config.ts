import { defineConfig, devices } from "@playwright/test";

/**
 * E2E runs against `next dev` in DEMO mode: the Supabase env vars are blanked
 * for the spawned server, so the app serves the seed catalogue and order
 * placement returns the mocked demo response — nothing touches a real DB.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3100",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Production build+serve: `next dev` refuses to start twice for the same
    // project, so this also coexists with a running local dev server.
    command: "pnpm build && pnpm start --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: {
      // Force demo mode even when .env.local points at a live project.
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
    },
  },
});
