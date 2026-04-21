import { defineConfig, devices } from "@playwright/test";

const E2E_HOST = "127.0.0.1";
const E2E_PORT = 4174;

export default defineConfig({
    testDir: "./tests/e2e",
    fullyParallel: true,
    retries: 0,
    webServer: {
        command:
            "VITE_FREELANCE_DATA_ADAPTER=json npm run build && npm run preview:e2e",
        url: `http://${E2E_HOST}:${E2E_PORT}`,
        reuseExistingServer: !process.env.CI,
        timeout: 180000,
    },
    use: {
        baseURL: `http://${E2E_HOST}:${E2E_PORT}`,
        trace: "on-first-retry",
    },
    projects: [
        {
            name: "desktop-chromium",
            use: {
                ...devices["Desktop Chrome"],
                viewport: { width: 1440, height: 900 },
            },
        },
        {
            name: "mobile-chromium",
            use: {
                ...devices["iPhone 12"],
                viewport: { width: 320, height: 800 },
            },
        },
        {
            name: "desktop-firefox",
            use: {
                ...devices["Desktop Firefox"],
                viewport: { width: 1440, height: 900 },
            },
        },
        {
            name: "desktop-webkit",
            use: {
                ...devices["Desktop Safari"],
                viewport: { width: 1440, height: 900 },
            },
        },
    ],
});
