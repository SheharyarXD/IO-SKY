/**
 * Milestone 3 §3.4 (RM-101) — Playwright end-to-end configuration.
 *
 * The plan calls for E2E coverage of the golden paths per portal. Two
 * constraints shape how this is set up:
 *
 * 1. There is no staging environment yet (Milestone 1 §1.3 is still gated on
 *    the hosting decision, RM-74). So by default Playwright boots the app
 *    locally via `webServer` rather than pointing at a deployed URL. Once
 *    staging exists, `E2E_BASE_URL` points the same specs at it with no code
 *    change — which is the point of putting it behind an env var now.
 *
 * 2. The only database currently configured is the client's live Supabase
 *    project. Specs that would create or mutate real rows are therefore
 *    gated behind `E2E_ALLOW_MUTATIONS=true` and skip by default. Running a
 *    booking or document-upload flow against a production database because a
 *    test runner happened to have credentials is not an acceptable default.
 *
 * Public, read-only paths run unconditionally — they are the ones that can be
 * verified honestly right now.
 */
import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100";
const usingExternalTarget = Boolean(process.env.E2E_BASE_URL);

export default defineConfig({
  testDir: "./e2e",
  // CI runners are slower and the app boots a full Vite dev server.
  timeout: 45_000,
  expect: { timeout: 10_000 },

  // Fail the run if a spec is left focused — `test.only` locally is fine,
  // silently reducing the CI suite to one test is not.
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // Capped rather than left to default (one worker per CPU core). The suite
  // runs against a single Vite dev server; saturating it with N parallel
  // browsers pushed portal round-trips past the assertion timeouts and
  // produced failures that passed in isolation every time. The bottleneck is
  // the server under test, not the runner, so more workers bought nothing.
  workers: process.env.CI ? 1 : 2,

  reporter: process.env.CI
    ? [["list"], ["html", { open: "never", outputFolder: "e2e-report" }]]
    : [["list"]],

  use: {
    baseURL: BASE_URL,
    // Artifacts only on failure — a green run should not leave hundreds of
    // megabytes of traces behind.
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // Mobile viewport: the Milestone 2 feedback specifically asks for
    // desktop/tablet/mobile responsive behaviour to be reviewable, so the
    // golden paths should be exercised at a phone width too, not just 1280px.
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
  ],

  // When E2E_BASE_URL is set we are testing something already running
  // (staging, or a container) and must not try to boot a second copy.
  webServer: usingExternalTarget
    ? undefined
    : {
        // Deliberately not `npm run dev`: that script is
        // `NODE_ENV=development tsx watch ...`, POSIX-only inline env syntax
        // that fails under cmd.exe on Windows. NODE_ENV is supplied via `env`
        // below instead, so this boots identically on both platforms.
        command: "npx tsx server/_core/index.ts",
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          NODE_ENV: "development",
          PORT: "3100",
        },
      },
});
