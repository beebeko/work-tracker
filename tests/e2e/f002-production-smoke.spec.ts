/**
 * F-002 post-deploy production smoke check.
 *
 * Non-destructive read-only validation against https://work-tracker-98f72.web.app.
 * No create/update/delete operations are performed.
 *
 * Smoke areas:
 *   1. App shell renders (no white screen, no unhandled error)
 *   2. Bootstrap/auth readiness — sync badge reaches Synced state
 *   3. Core tab/panel navigation (Entry, Entry History, Pay Summary, Organization)
 *   4. Filter/selector sanity (at least one selector responds without console error)
 */

import { expect, test } from "@playwright/test";

// Allow up to 35 s for the production Firebase anonymous-auth bootstrap (if in Firebase mode).
const BOOTSTRAP_TIMEOUT_MS = 35_000;
// Allow up to 15 s for navigation/render after the bootstrap.
const NAVIGATION_TIMEOUT_MS = 15_000;

/**
 * Wait for the app to be "ready" for interaction.
 * Handles both Firebase mode (wait for "Synced" badge) and JSON mode (no badge, but app shell visible).
 * Returns the observed adapter mode.
 */
async function waitForAppReady(
    page: import("@playwright/test").Page,
): Promise<"firebase" | "json"> {
    // Wait for the app container and heading to appear
    await expect(page.locator(".freelance-tracker-app")).toBeVisible({
        timeout: BOOTSTRAP_TIMEOUT_MS,
    });
    await expect(
        page.getByRole("heading", { name: /freelance hours tracker/i }),
    ).toBeVisible({ timeout: NAVIGATION_TIMEOUT_MS });

    // Check if a sync badge exists at all (Firebase mode)
    const syncBadge = page.locator(".freelance-tracker-app__sync-status");
    const badgeCount = await syncBadge.count();

    if (badgeCount > 0) {
        // Firebase mode: wait for the badge to reach "Synced"
        await expect(
            page.locator(".freelance-tracker-app__sync-status--synced"),
        ).toBeVisible({ timeout: BOOTSTRAP_TIMEOUT_MS });
        return "firebase";
    }

    // JSON mode: no badge, app renders immediately — confirm no stuck loading indicator
    await expect(
        page.locator(".freelance-tracker-app__loading-indicator"),
    ).toHaveCount(0, { timeout: BOOTSTRAP_TIMEOUT_MS });
    // Confirm AppStartupGate is not showing a "Syncing" state
    await expect(page.locator(".app-startup-gate__status")).toHaveCount(0, {
        timeout: 5000,
    });
    return "json";
}

const PRODUCTION_URL = "https://work-tracker-98f72.web.app";

test.describe("F-002 production smoke check", () => {
    const consoleErrors: string[] = [];

    test.beforeEach(async ({ page }) => {
        consoleErrors.length = 0;
        page.on("console", (msg) => {
            if (msg.type() === "error") {
                consoleErrors.push(`[console.error] ${msg.text()}`);
            }
        });
        page.on("pageerror", (err) => {
            consoleErrors.push(`[uncaught] ${err.message}`);
        });
    });

    // ── Smoke area 1: App shell renders ──────────────────────────────────────

    test("smoke-1: app shell renders without white screen or unhandled error", async ({
        page,
    }) => {
        await page.goto(PRODUCTION_URL, { waitUntil: "domcontentloaded" });

        // App-level container must exist (not a blank page)
        await expect(page.locator(".freelance-tracker-app")).toBeVisible({
            timeout: BOOTSTRAP_TIMEOUT_MS,
        });

        // Primary heading must appear
        await expect(
            page.getByRole("heading", { name: /freelance hours tracker/i }),
        ).toBeVisible({ timeout: NAVIGATION_TIMEOUT_MS });

        // No loading overlay should remain stuck indefinitely after bootstrap
        await expect(
            page.locator(".freelance-tracker-app__loading-indicator"),
        ).toHaveCount(0, { timeout: BOOTSTRAP_TIMEOUT_MS });

        // No AppStartupGate error screen
        await expect(page.locator(".app-startup-gate__error")).toHaveCount(0, {
            timeout: 5000,
        });
    });

    // ── Smoke area 2: Bootstrap/auth readiness ────────────────────────────────

    test("smoke-2: bootstrap resolves (Synced badge in Firebase mode; immediate render in JSON mode)", async ({
        page,
    }) => {
        await page.goto(PRODUCTION_URL, { waitUntil: "domcontentloaded" });

        const mode = await waitForAppReady(page);

        if (mode === "firebase") {
            // Firebase mode: badge must show "Synced", never "Bootstrap Error"
            await expect(
                page.locator(".freelance-tracker-app__sync-status"),
            ).toHaveText("Synced", { timeout: 5000 });
            await expect(
                page.locator(
                    ".freelance-tracker-app__sync-status--bootstrap-error",
                ),
            ).toHaveCount(0);
        } else {
            // JSON mode: no sync badge at all is correct; app renders without blocking bootstrap
            const badgeCount = await page
                .locator(".freelance-tracker-app__sync-status")
                .count();
            expect(badgeCount, "JSON mode: no sync badge expected").toBe(0);
            // Confirm entry form is immediately available
            await expect(
                page.getByRole("heading", { name: /new entry/i }),
            ).toBeVisible({ timeout: NAVIGATION_TIMEOUT_MS });
        }
    });

    // ── Smoke area 3: Core tab/panel navigation ───────────────────────────────

    test("smoke-3: all four tabs are clickable and activate their panels", async ({
        page,
    }) => {
        await page.goto(PRODUCTION_URL, { waitUntil: "domcontentloaded" });
        await waitForAppReady(page);

        const viewport = page.viewportSize();
        const isDesktop = viewport != null && viewport.width >= 1024;

        if (isDesktop) {
            // On desktop (≥1024px): mobile tabs are hidden; panels are always in a
            // 3-column grid and visible without clicking. Verify each panel is
            // present and the left-panel sub-tabs (Entry/Organization) are clickable.

            // History and Summary panels are always visible on desktop
            await expect(page.locator("#freelance-panel-history")).toBeVisible({
                timeout: NAVIGATION_TIMEOUT_MS,
            });
            await expect(page.locator("#freelance-panel-summary")).toBeVisible({
                timeout: NAVIGATION_TIMEOUT_MS,
            });

            // Left-panel Organization sub-tab
            const orgLeftTab = page
                .locator(".freelance-tracker-app__left-tabs")
                .getByRole("button", { name: /organization/i, exact: false });
            await expect(orgLeftTab).toBeVisible();
            await orgLeftTab.click();
            // Left panel should remain visible after switching
            await expect(page.locator("#freelance-panel-left")).toBeVisible({
                timeout: NAVIGATION_TIMEOUT_MS,
            });

            // Left-panel Entry sub-tab
            const entryLeftTab = page
                .locator(".freelance-tracker-app__left-tabs")
                .getByRole("button", { name: "Entry", exact: true });
            await expect(entryLeftTab).toBeVisible();
            await entryLeftTab.click();
            await expect(page.locator("#freelance-panel-entry")).toBeVisible({
                timeout: NAVIGATION_TIMEOUT_MS,
            });
        } else {
            // On mobile (<1024px): use the top-nav tab buttons
            await page.locator("#freelance-tab-history").click();
            await expect(page.locator("#freelance-panel-history")).toBeVisible({
                timeout: NAVIGATION_TIMEOUT_MS,
            });

            await page.locator("#freelance-tab-summary").click();
            await expect(page.locator("#freelance-panel-summary")).toBeVisible({
                timeout: NAVIGATION_TIMEOUT_MS,
            });

            await page.locator("#freelance-tab-organization").click();
            await expect(page.locator("#freelance-panel-left")).toBeVisible({
                timeout: NAVIGATION_TIMEOUT_MS,
            });

            await page.locator("#freelance-tab-entry").click();
            await expect(page.locator("#freelance-panel-entry")).toBeVisible({
                timeout: NAVIGATION_TIMEOUT_MS,
            });
        }

        // No console errors observed during navigation
        const navErrors = consoleErrors.filter((e) => !e.includes("favicon"));
        expect(
            navErrors,
            `Console errors during navigation: ${navErrors.join("; ")}`,
        ).toHaveLength(0);
    });

    // ── Smoke area 4: Filter/selector sanity ─────────────────────────────────

    test("smoke-4: filter/selector in Entry History responds without console error", async ({
        page,
    }) => {
        await page.goto(PRODUCTION_URL, { waitUntil: "domcontentloaded" });
        await waitForAppReady(page);

        const viewport = page.viewportSize();
        const isDesktop = viewport != null && viewport.width >= 1024;

        // Navigate to Entry History (mobile: click tab; desktop: panel already visible)
        if (!isDesktop) {
            await page.locator("#freelance-tab-history").click();
        }
        await expect(page.locator("#freelance-panel-history")).toBeVisible({
            timeout: NAVIGATION_TIMEOUT_MS,
        });

        // Snapshot error count before interacting with filters
        const errorsBefore = consoleErrors.length;

        // Toggle the "Filter by organization" checkbox (read-only filter toggle)
        const filterCheckbox = page.locator("#history-filter-by-org");
        if ((await filterCheckbox.count()) > 0) {
            await filterCheckbox.click();
            // Toggle back immediately to remain read-only/non-destructive
            await filterCheckbox.click();
        }

        // Navigate to Pay Summary and try its filter (also read-only)
        if (!isDesktop) {
            await page.locator("#freelance-tab-summary").click();
        }
        await expect(page.locator("#freelance-panel-summary")).toBeVisible({
            timeout: NAVIGATION_TIMEOUT_MS,
        });

        const summaryOrgFilter = page.locator("#pay-summary-filter-by-org");
        if ((await summaryOrgFilter.count()) > 0) {
            await summaryOrgFilter.click();
            // Toggle back
            await summaryOrgFilter.click();
        }

        // No new console errors introduced by filter interactions
        const errorsAfter = consoleErrors
            .slice(errorsBefore)
            .filter((e) => !e.includes("favicon"));
        expect(
            errorsAfter,
            `Console errors during filter interaction: ${errorsAfter.join("; ")}`,
        ).toHaveLength(0);
    });
});
