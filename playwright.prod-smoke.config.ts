import { defineConfig, devices } from "@playwright/test";

/** Temporary config for non-destructive production smoke check against F-002 deployed URL. */
export default defineConfig({
    testDir: "./tests/e2e",
    testMatch: "**/f002-production-smoke.spec.ts",
    fullyParallel: false,
    retries: 0,
    use: {
        baseURL: "https://work-tracker-98f72.web.app",
        trace: "on-first-retry",
        actionTimeout: 15000,
        navigationTimeout: 30000,
    },
    projects: [
        {
            name: "prod-smoke-chromium",
            use: {
                ...devices["Desktop Chrome"],
                viewport: { width: 1440, height: 900 },
            },
        },
        {
            name: "prod-smoke-firefox",
            use: {
                ...devices["Desktop Firefox"],
                viewport: { width: 1440, height: 900 },
            },
        },
    ],
});
