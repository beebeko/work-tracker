import { defineConfig, devices } from "@playwright/test";

const E2E_HOST = "127.0.0.1";
const E2E_PORT = 4174;

const FIREBASE_E2E_ENV = [
    "VITE_FREELANCE_DATA_ADAPTER=firebase",
    "VITE_USE_FIREBASE_EMULATOR=true",
    "VITE_FIREBASE_API_KEY=demo-api-key",
    "VITE_FIREBASE_AUTH_DOMAIN=work-tracker-98f72.firebaseapp.com",
    "VITE_FIREBASE_PROJECT_ID=work-tracker-98f72",
    "VITE_FIREBASE_APP_ID=1:1234567890:web:e2e",
].join(" ");

export default defineConfig({
    testDir: "./tests/e2e",
    testMatch: "**/f002-emulator-org-ruleset.spec.ts",
    fullyParallel: false,
    workers: 1,
    retries: 0,
    webServer: {
        command: `${FIREBASE_E2E_ENV} npm run build && npm run preview:e2e`,
        url: `http://${E2E_HOST}:${E2E_PORT}`,
        reuseExistingServer: false,
        timeout: 180000,
    },
    use: {
        baseURL: `http://${E2E_HOST}:${E2E_PORT}`,
        trace: "on-first-retry",
        actionTimeout: 15000,
        navigationTimeout: 30000,
    },
    projects: [
        {
            name: "emulator-chromium",
            use: {
                ...devices["Desktop Chrome"],
                viewport: { width: 1440, height: 900 },
            },
        },
        {
            name: "emulator-firefox",
            use: {
                ...devices["Desktop Firefox"],
                viewport: { width: 1440, height: 900 },
            },
        },
        {
            name: "emulator-webkit",
            use: {
                ...devices["Desktop Safari"],
                viewport: { width: 1440, height: 900 },
            },
        },
    ],
});
