import fs from "fs";
import path from "path";

import { expect, test } from "@playwright/test";

const BOOTSTRAP_TIMEOUT_MS = 35_000;

const WEBKIT_EMULATOR_THRESHOLD_MS = Number(
    process.env.WEBKIT_EMULATOR_THRESHOLD_MS ?? 45_000,
);

function dateFromOffset(dayOffset: number): string {
    const date = new Date(Date.UTC(2026, 3, 1 + dayOffset));
    return date.toISOString().slice(0, 10);
}

async function waitForFirebaseReady(
    page: import("@playwright/test").Page,
): Promise<void> {
    await expect(
        page.getByRole("heading", { name: /freelance hours tracker/i }),
    ).toBeVisible({ timeout: BOOTSTRAP_TIMEOUT_MS });

    await expect(
        page.locator(".freelance-tracker-app__loading-indicator"),
    ).toHaveCount(0, { timeout: BOOTSTRAP_TIMEOUT_MS });

    await expect(
        page.locator(".freelance-tracker-app__sync-status--synced"),
    ).toBeVisible({ timeout: BOOTSTRAP_TIMEOUT_MS });
}

test.describe("F-002 emulator org + ruleset attachment", () => {
    let _webkitRunStart: number | undefined;

    test.beforeAll(async ({}, testInfo) => {
        if (testInfo.project.name.toLowerCase().includes("webkit")) {
            _webkitRunStart = Date.now();
        }
    });

    test.afterAll(async ({}, testInfo) => {
        if (
            !testInfo.project.name.toLowerCase().includes("webkit") ||
            _webkitRunStart === undefined
        ) {
            return;
        }

        const elapsed = Date.now() - _webkitRunStart;
        const threshold = WEBKIT_EMULATOR_THRESHOLD_MS;
        const exceeded = elapsed > threshold;

        const artifactDir = path.resolve("test-results");
        if (!fs.existsSync(artifactDir)) {
            fs.mkdirSync(artifactDir, { recursive: true });
        }
        const artifact = {
            date: new Date().toISOString(),
            project: testInfo.project.name,
            elapsed_ms: elapsed,
            threshold_ms: threshold,
            exceeded,
        };
        fs.writeFileSync(
            path.join(artifactDir, "webkit-emulator-timing.json"),
            JSON.stringify(artifact, null, 2) + "\n",
        );

        if (exceeded) {
            // To escalate to a hard failure, replace console.warn with:
            //   throw new Error(`[WEBKIT-LATENCY-ALERT] ${elapsed}ms > ${threshold}ms`);
            console.warn(
                `\n[WEBKIT-LATENCY-ALERT] WebKit emulator test exceeded threshold!`,
            );
            console.warn(
                `  Measured: ${elapsed}ms | Threshold: ${threshold}ms | Project: ${testInfo.project.name}`,
            );
            console.warn(
                `  Artifact: test-results/webkit-emulator-timing.json`,
            );
        }
    });

    test("creates an organization and attaches a newly authored shared ruleset", async ({
        page,
    }, testInfo) => {
        test.setTimeout(90000);

        const runSuffix = `${testInfo.project.name}-${Date.now()}`.replace(
            /[^a-z0-9-]/gi,
            "-",
        );
        const organizationName = `OrgE2E-${runSuffix.slice(-12)}`;

        const projectOffset = testInfo.project.name.includes("firefox")
            ? 13
            : testInfo.project.name.includes("webkit")
              ? 17
              : 9;
        const dynamicOffset = projectOffset + (Date.now() % 5);
        const newRulesetDate = dateFromOffset(dynamicOffset);

        await page.addInitScript(() => {
            window.localStorage.clear();
        });

        await page.goto("/");
        await waitForFirebaseReady(page);

        const entryPanel = page.locator("#freelance-panel-entry");
        const orgInput = entryPanel.getByPlaceholder(
            /select or type organization/i,
        );

        await expect(entryPanel).toBeVisible();
        await orgInput.fill(organizationName);
        const addOrganizationButton = entryPanel.getByRole("button", {
            name: /add organization/i,
        });
        await addOrganizationButton.scrollIntoViewIfNeeded();
        await orgInput.blur();
        await addOrganizationButton.click({ force: true });

        const organizationDialog = page.getByRole("dialog", {
            name: /new organization/i,
        });

        const openedFromPrimaryClick = await organizationDialog
            .isVisible({ timeout: 2000 })
            .catch(() => false);

        if (!openedFromPrimaryClick) {
            await addOrganizationButton.dispatchEvent("click");
        }

        const openedFromDispatch = await organizationDialog
            .isVisible({ timeout: 2000 })
            .catch(() => false);

        if (!openedFromDispatch) {
            await orgInput.press("Enter");
        }

        await expect(organizationDialog).toBeVisible({ timeout: 10000 });

        await organizationDialog
            .getByRole("button", { name: /\+ new shared ruleset/i })
            .click();
        await organizationDialog
            .getByRole("button", { name: /\+ new ruleset/i })
            .click();
        await organizationDialog
            .getByLabel(/ruleset effective date/i)
            .fill(newRulesetDate);
        await organizationDialog
            .getByRole("button", { name: /^\+ Meal Penalty$/i })
            .click();
        await organizationDialog.getByLabel(/meal penalty amount/i).fill("45");
        await organizationDialog
            .getByRole("button", { name: /save ruleset/i })
            .click();

        const newRulesetCheckbox = organizationDialog.getByRole("checkbox", {
            name: new RegExp(`effective ${newRulesetDate}`, "i"),
        });
        await expect(newRulesetCheckbox).toBeVisible({ timeout: 15000 });
        await newRulesetCheckbox.check();
        await expect(newRulesetCheckbox).toBeChecked();
        await expect(
            page.locator(".freelance-tracker-app__sync-status--synced"),
        ).toBeVisible({ timeout: 90000 });
        await expect(
            page.locator(".freelance-tracker-app__loading-indicator"),
        ).toHaveCount(0, { timeout: 90000 });

        const hideSharedRulesetBuilderButton = organizationDialog.getByRole(
            "button",
            { name: /hide shared ruleset builder/i },
        );
        const isBuilderOpen = await hideSharedRulesetBuilderButton
            .isVisible()
            .catch(() => false);
        if (isBuilderOpen) {
            await hideSharedRulesetBuilderButton.click();
        }

        const saveOrganizationButton = organizationDialog.getByRole("button", {
            name: /save organization/i,
        });
        await saveOrganizationButton.scrollIntoViewIfNeeded();
        await saveOrganizationButton.click();

        await expect
            .poll(
                async () =>
                    page
                        .getByRole("dialog", { name: /new organization/i })
                        .count(),
                {
                    timeout: 90000,
                },
            )
            .toBe(0);
        await expect(
            page.locator(".freelance-tracker-app__sync-status--synced"),
        ).toBeVisible({ timeout: 90000 });
        await expect(orgInput).toHaveValue(organizationName);

        const organizationTab = page
            .locator(".freelance-tracker-app__left-tabs")
            .getByRole("button", {
                name: "Organization",
                exact: true,
            });
        await organizationTab.click();

        const organizationPanel = page.locator("#freelance-panel-organization");
        await expect(organizationPanel).toBeVisible();

        await organizationPanel
            .getByRole("button", { name: organizationName, exact: true })
            .click();

        const detailsDialog = page.getByTestId("organization-details-dialog");
        await expect(detailsDialog).toBeVisible();

        const attachedRulesetCheckbox = detailsDialog.getByRole("checkbox", {
            name: new RegExp(`effective ${newRulesetDate}`, "i"),
        });
        await expect(attachedRulesetCheckbox).toBeChecked();
    });
});
