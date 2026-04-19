import { expect, test, type Locator, type Page } from "@playwright/test";

type TrackerView = "Entry" | "Organization" | "Entry History" | "Pay Summary";
type E2EStartupOverrides = {
    forceFirebaseMode: boolean;
    bootstrapOutcomes: Array<"success" | "error">;
    bootstrapErrorMessage?: string;
    __bootstrapCallCount?: number;
};

type E2EWindow = Window & {
    __FREELANCE_E2E_STARTUP__?: E2EStartupOverrides;
};

const panelSelectorByView: Record<TrackerView, string> = {
    Entry: "#freelance-panel-entry",
    Organization: "#freelance-panel-organization",
    "Entry History": "#freelance-panel-history",
    "Pay Summary": "#freelance-panel-summary",
};

const tabLabelByView: Record<TrackerView, string> = {
    Entry: "Entry",
    Organization: "Organization",
    "Entry History": "Entry History",
    "Pay Summary": "Pay Summary",
};

const tabSelectorByView: Record<TrackerView, string> = {
    Entry: "#freelance-tab-entry",
    Organization: "#freelance-tab-organization",
    "Entry History": "#freelance-tab-history",
    "Pay Summary": "#freelance-tab-summary",
};

const ENTRY_ROW_STACK_BREAKPOINT_PX = 480;

function panelForView(page: Page, view: TrackerView): Locator {
    return page.locator(panelSelectorByView[view]);
}

function fieldContainerFor(control: Locator): Locator {
    return control.locator(
        "xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' entry-form__field ')][1]",
    );
}

function rowContainerFor(control: Locator): Locator {
    return control.locator(
        "xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' entry-form__row ')][1]",
    );
}

async function closeOrganizationDetailsDialogIfOpen(page: Page) {
    const detailsDialog = page.getByTestId("organization-details-dialog");
    if ((await detailsDialog.count()) === 0) {
        return;
    }

    await detailsDialog
        .getByTestId("organization-details-close")
        .first()
        .click();
    await expect(detailsDialog).toHaveCount(0);
}

async function expectResponsiveEntryRowLayout(
    viewportWidth: number,
    row: Locator,
    firstField: Locator,
    secondField: Locator,
) {
    await expect(row).toBeVisible();
    await expect(firstField).toBeVisible();
    await expect(secondField).toBeVisible();

    const [rowBox, firstBox, secondBox] = await Promise.all([
        row.boundingBox(),
        firstField.boundingBox(),
        secondField.boundingBox(),
    ]);
    const [rowNoOverflow, firstNoOverflow, secondNoOverflow] =
        await Promise.all([
            row.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
            firstField.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
            secondField.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
        ]);

    expect(rowBox).not.toBeNull();
    expect(firstBox).not.toBeNull();
    expect(secondBox).not.toBeNull();
    expect(rowNoOverflow).toBe(true);
    expect(firstNoOverflow).toBe(true);
    expect(secondNoOverflow).toBe(true);

    const resolvedRowBox = rowBox as NonNullable<typeof rowBox>;
    const resolvedFirstBox = firstBox as NonNullable<typeof firstBox>;
    const resolvedSecondBox = secondBox as NonNullable<typeof secondBox>;

    expect(resolvedFirstBox.x + resolvedFirstBox.width).toBeLessThanOrEqual(
        resolvedRowBox.x + resolvedRowBox.width + 1,
    );
    expect(resolvedSecondBox.x + resolvedSecondBox.width).toBeLessThanOrEqual(
        resolvedRowBox.x + resolvedRowBox.width + 1,
    );

    if (viewportWidth < ENTRY_ROW_STACK_BREAKPOINT_PX) {
        expect(resolvedSecondBox.y).toBeGreaterThan(resolvedFirstBox.y + 12);
        expect(resolvedSecondBox.x).toBeLessThanOrEqual(resolvedFirstBox.x + 8);
        return;
    }

    const topDelta = Math.abs(resolvedFirstBox.y - resolvedSecondBox.y);
    expect(topDelta).toBeLessThan(8);
    expect(resolvedSecondBox.x).toBeGreaterThan(resolvedFirstBox.x + 8);
}

async function getViewportWidth(page: Page): Promise<number> {
    const configuredViewport = page.viewportSize();
    if (configuredViewport && configuredViewport.width > 0) {
        return configuredViewport.width;
    }

    return page.evaluate(() => window.innerWidth);
}

const E2E_ORG_NAME = "E2E Organization";
const E2E_CREATED_AT = "2026-04-17T00:00:00.000Z";

const DEFAULT_E2E_ORGANIZATION = {
    organizationId: "org-e2edefault",
    name: E2E_ORG_NAME,
    payPeriodStartDay: 1,
    timezone: "UTC",
    workweekStartDay: 1,
    createdAt: E2E_CREATED_AT,
    venues: [],
    positions: [],
};

async function seedBaselineData(page: Page) {
    await page.evaluate((organization) => {
        window.localStorage.setItem(
            "freelance-tracker:organizations",
            JSON.stringify([organization]),
        );
        window.localStorage.setItem("freelance-tracker:entries", "[]");
        window.localStorage.setItem("freelance-tracker:tags", "[]");
        window.localStorage.setItem("freelance-tracker:positions", "[]");
        window.localStorage.setItem("freelance-tracker:venues", "[]");
        window.localStorage.setItem("freelance-tracker:rulesets", "[]");
    }, DEFAULT_E2E_ORGANIZATION);
}

async function configureE2EStartup(
    page: Page,
    startupOverrides: E2EStartupOverrides,
) {
    await page.addInitScript((value: E2EStartupOverrides) => {
        (window as E2EWindow).__FREELANCE_E2E_STARTUP__ = value;
    }, startupOverrides);

    await page.reload();
}

async function waitForAppReady(page: Page) {
    await expect(
        page.getByRole("heading", { name: /freelance hours tracker/i }),
    ).toBeVisible({ timeout: 15000 });

    await expect(
        page.locator(".freelance-tracker-app__loading-indicator"),
    ).toHaveCount(0, { timeout: 15000 });
}

async function ensureView(page: Page, isMobile: boolean, view: TrackerView) {
    await closeOrganizationDetailsDialogIfOpen(page);

    const panel = panelForView(page, view);

    if (isMobile) {
        const tab = page.locator(tabSelectorByView[view]);
        await expect(tab).toBeVisible();
        await tab.click();
        await expect(tab).toHaveClass(/freelance-tracker-app__tab--active/);
    } else if (view === "Entry" || view === "Organization") {
        const leftTab = page
            .locator(".freelance-tracker-app__left-tabs")
            .getByRole("button", {
                name: tabLabelByView[view],
                exact: true,
            });
        await leftTab.click();
    }

    await expect(panel).toBeVisible();

    return panel;
}

async function filterSummaryToOrganization(
    summaryPanel: Locator,
    organizationName: string,
) {
    const byOrgCheckbox = summaryPanel.locator("#pay-summary-filter-by-org");
    const orgSelect = summaryPanel.locator("#summary-organization-filter");

    await expect(byOrgCheckbox).toBeVisible();
    if (!(await byOrgCheckbox.isChecked())) {
        await byOrgCheckbox.check();
    }

    await expect(orgSelect).toBeEnabled();
    await orgSelect.selectOption({ label: organizationName });
    await expect(orgSelect.locator("option:checked")).toHaveText(
        organizationName,
    );
}

async function fillAndSubmitEntry(
    page: Page,
    seed: {
        position: string;
        dateWorked?: string;
        startTime?: string;
        endTime?: string;
        paymentMode?: "hourly" | "flat-fee";
        flatFeeAmount?: string;
        rate?: string;
        tags?: string[];
    },
) {
    await ensureOrganizationSelected(page, E2E_ORG_NAME);

    const entryPanel = panelForView(page, "Entry");
    const tagInput = entryPanel.getByLabel(/tags/i);

    await expect(entryPanel).toBeVisible();
    await entryPanel
        .getByLabel("Position", { exact: true })
        .fill(seed.position);
    await entryPanel
        .getByLabel("Date", { exact: true })
        .fill(seed.dateWorked ?? "2026-04-16");
    await entryPanel
        .getByLabel("Start Time", { exact: true })
        .fill(seed.startTime ?? "09:00");
    await entryPanel
        .getByLabel("End Time", { exact: true })
        .fill(seed.endTime ?? "11:00");

    if (seed.paymentMode === "flat-fee") {
        await entryPanel.getByLabel(/flat fee/i).click();
        await entryPanel
            .getByLabel(/flat-fee amount/i)
            .fill(seed.flatFeeAmount ?? "0");
    } else if (seed.rate) {
        await entryPanel.getByLabel(/rate/i).fill(seed.rate);
    }

    for (const tag of seed.tags ?? []) {
        await tagInput.fill(tag);
        await tagInput.press("Enter");
    }

    const createEntryButton = entryPanel.getByRole("button", {
        name: /create entry/i,
    });

    await createEntryButton.click();

    const newPositionDialog = page.getByRole("dialog", {
        name: /new position for/i,
    });

    if ((await newPositionDialog.count()) > 0) {
        await newPositionDialog
            .getByRole("button", { name: /^save$/i })
            .click();
        await expect(newPositionDialog).toHaveCount(0);
        await createEntryButton.click();
    }
}

async function saveNewPositionDialogIfOpen(page: Page) {
    const newPositionDialog = page.getByRole("dialog", {
        name: /new position for/i,
    });

    if ((await newPositionDialog.count()) === 0) {
        return false;
    }

    await newPositionDialog.getByRole("button", { name: /^save$/i }).click();
    await expect(newPositionDialog).toHaveCount(0);
    return true;
}

async function ensureOrganizationSelected(page: Page, name: string) {
    const entryPanel = panelForView(page, "Entry");
    const orgInput = entryPanel.getByPlaceholder(
        /select or type organization/i,
    );

    await expect(entryPanel).toBeVisible();
    await expect
        .poll(async () => {
            return page.evaluate((orgName) => {
                const raw = window.localStorage.getItem(
                    "freelance-tracker:organizations",
                );
                const organizations = raw
                    ? (JSON.parse(raw) as Array<{ name?: string }>)
                    : [];

                return organizations.some((org) => org.name === orgName);
            }, name);
        })
        .toBe(true);

    await orgInput.fill("");
    await orgInput.fill(name);
    await orgInput.blur();
    await expect(
        entryPanel.getByRole("button", { name: /manage organizations/i }),
    ).toHaveCount(0);
    await expect(orgInput).toHaveValue(name);
}

async function openRulesetsPanel(page: Page, isMobile: boolean) {
    const organizationPanel = await ensureView(page, isMobile, "Organization");
    await expect(
        organizationPanel.getByRole("heading", { name: /organizations/i }),
    ).toBeVisible();

    const organizationButton = organizationPanel
        .getByRole("button", { name: E2E_ORG_NAME, exact: true })
        .first();

    await expect(organizationButton).toBeVisible();
    await organizationButton.click();

    const rulesetsPanel = page.getByTestId("organization-details-dialog");
    await expect(rulesetsPanel).toBeVisible();
    await expect(
        rulesetsPanel.getByRole("heading", { name: /pay rulesets/i }),
    ).toBeVisible();
    return rulesetsPanel;
}

async function openNewRuleset(page: Page, isMobile: boolean) {
    const rulesetsPanel = await openRulesetsPanel(page, isMobile);

    await rulesetsPanel
        .getByRole("button", { name: /\+ new ruleset/i })
        .click();
    await expect(
        rulesetsPanel.getByRole("heading", { name: /new ruleset/i }),
    ).toBeVisible();

    return rulesetsPanel;
}

async function createRulesetWithDailyOtAndCustomTagBonus(
    page: Page,
    isMobile: boolean,
) {
    const rulesetsPanel = await openNewRuleset(page, isMobile);

    await rulesetsPanel
        .getByLabel(/ruleset effective date/i)
        .fill("2026-04-01");
    await rulesetsPanel.getByRole("button", { name: "Daily OT" }).click();

    const overtimeFields = rulesetsPanel
        .locator(".ruleset-editor__rule-fields")
        .first();
    await overtimeFields.getByPlaceholder(/daily ot/i).fill("Daily OT 1.5x");
    await overtimeFields.getByLabel(/daily threshold hours/i).fill("8");
    await overtimeFields.getByLabel(/overtime multiplier/i).fill("1.5");

    await rulesetsPanel.getByRole("button", { name: /^\+ Custom$/i }).click();

    const customRow = rulesetsPanel.locator(".ruleset-editor__rule-row").last();
    await customRow
        .getByPlaceholder(/label shown in pay summary/i)
        .fill("Night Bonus");
    await customRow.getByLabel(/custom rule scope/i).selectOption("tag");
    await customRow.getByLabel(/custom rule matches value/i).fill("night");
    await customRow.getByLabel(/custom rule multiplier value/i).fill("1.25");

    await rulesetsPanel.getByRole("button", { name: /save ruleset/i }).click();
    await expect(
        rulesetsPanel.getByRole("heading", { name: /pay rulesets/i }),
    ).toBeVisible();
}

test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
        (window as E2EWindow).__FREELANCE_E2E_STARTUP__ = {
            forceFirebaseMode: false,
            bootstrapOutcomes: [],
            ...(window as E2EWindow).__FREELANCE_E2E_STARTUP__,
        };
    });

    await page.goto("/");
    await page.evaluate(() => window.localStorage.clear());
    await seedBaselineData(page);
    await page.reload();
    await waitForAppReady(page);
});

test("firebase-mode startup succeeds and shows synced readiness cue", async ({
    page,
}) => {
    await configureE2EStartup(page, {
        forceFirebaseMode: true,
        bootstrapOutcomes: ["success"],
    });

    await expect(
        page.getByRole("heading", { name: /freelance hours tracker/i }),
    ).toBeVisible();
    await expect(page.getByText("Synced")).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
});

test("firebase-mode bootstrap error is visible and retry recovers", async ({
    page,
}) => {
    await configureE2EStartup(page, {
        forceFirebaseMode: true,
        bootstrapOutcomes: ["error", "error", "success"],
        bootstrapErrorMessage: "E2E forced bootstrap failure",
    });

    const bootstrapAlert = page.getByRole("alert");
    await expect(bootstrapAlert).toBeVisible();
    await expect(bootstrapAlert).toContainText("Bootstrap Error");
    await expect(bootstrapAlert).toContainText("E2E forced bootstrap failure");
    await expect(
        page.getByRole("heading", { name: /freelance hours tracker/i }),
    ).toHaveCount(0);

    const appHeading = page.getByRole("heading", {
        name: /freelance hours tracker/i,
    });
    const retryButton = page.getByRole("button", { name: /retry/i });

    // Bootstrap outcomes can be consumed differently depending on runtime timing.
    // Retry up to two times and assert recovery once startup completes.
    for (let attempt = 0; attempt < 2; attempt += 1) {
        await retryButton.click();
        const recovered = await appHeading
            .isVisible({ timeout: 5000 })
            .catch(() => false);
        if (recovered) {
            break;
        }
        await expect(bootstrapAlert).toBeVisible();
    }

    await waitForAppReady(page);
    await expect(page.getByText("Synced")).toBeVisible({ timeout: 15000 });
});

test("firebase-mode reconnect updates status from offline back to synced", async ({
    page,
}) => {
    await configureE2EStartup(page, {
        forceFirebaseMode: true,
        bootstrapOutcomes: ["success"],
    });

    await expect(page.getByText("Synced")).toBeVisible();

    await page.evaluate(() => {
        window.dispatchEvent(new Event("offline"));
    });
    await expect(page.getByText("Offline")).toBeVisible();

    await page.evaluate(() => {
        window.dispatchEvent(new Event("online"));
    });
    await expect(page.getByText("Synced")).toBeVisible();
});

test("desktop shows three side-by-side panels in left to right order", async ({
    page,
    isMobile,
}) => {
    const entryPanel = page.locator("#freelance-panel-entry");
    const historyPanel = page.locator("#freelance-panel-history");
    const summaryPanel = page.locator("#freelance-panel-summary");

    if (isMobile) {
        await expect(
            page.locator(".freelance-tracker-app__tabs"),
        ).toBeVisible();
        await expect(entryPanel).toBeVisible();
        await expect(historyPanel).not.toBeVisible();
        await expect(summaryPanel).not.toBeVisible();
        return;
    }

    await expect(entryPanel).toBeVisible();
    await expect(historyPanel).toBeVisible();
    await expect(summaryPanel).toBeVisible();
    await expect(page.locator(".freelance-tracker-app__tabs")).toBeHidden();

    const [entryBox, historyBox, summaryBox] = await Promise.all([
        entryPanel.boundingBox(),
        historyPanel.boundingBox(),
        summaryPanel.boundingBox(),
    ]);

    expect(entryBox).not.toBeNull();
    expect(historyBox).not.toBeNull();
    expect(summaryBox).not.toBeNull();

    expect((entryBox as NonNullable<typeof entryBox>).x).toBeLessThan(
        (historyBox as NonNullable<typeof historyBox>).x,
    );
    expect((historyBox as NonNullable<typeof historyBox>).x).toBeLessThan(
        (summaryBox as NonNullable<typeof summaryBox>).x,
    );

    await expect(
        entryPanel.getByRole("heading", { name: /new entry/i }),
    ).toBeVisible();
    await expect(
        historyPanel.getByRole("heading", { name: /entry history/i }),
    ).toBeVisible();
    await expect(
        summaryPanel.getByRole("heading", { name: /pay summary/i }),
    ).toBeVisible();
});

test("mobile uses full-width tabs with Entry active by default", async ({
    page,
    isMobile,
}) => {
    await ensureOrganizationSelected(page, E2E_ORG_NAME);

    const tabs = page.locator(".freelance-tracker-app__tabs");
    const entryTab = page.locator("#freelance-tab-entry");
    const organizationTab = page.locator("#freelance-tab-organization");
    const historyTab = page.getByRole("button", { name: "Entry History" });
    const summaryTab = page.getByRole("button", { name: "Pay Summary" });
    const entryPanel = page.locator("#freelance-panel-entry");
    const organizationPanel = page.locator("#freelance-panel-organization");
    const historyPanel = page.locator("#freelance-panel-history");
    const summaryPanel = page.locator("#freelance-panel-summary");

    if (!isMobile) {
        await expect(tabs).toBeHidden();
        await expect(entryPanel).toBeVisible();
        await expect(organizationPanel).not.toBeVisible();
        await expect(historyPanel).toBeVisible();
        await expect(summaryPanel).toBeVisible();
        return;
    }

    await expect(tabs).toBeVisible();
    await expect(entryTab).toHaveClass(/freelance-tracker-app__tab--active/);
    await expect(entryPanel).toBeVisible();
    await expect(organizationPanel).not.toBeVisible();
    await expect(historyPanel).not.toBeVisible();
    await expect(summaryPanel).not.toBeVisible();

    const [
        tabsBox,
        entryTabBox,
        organizationTabBox,
        historyTabBox,
        summaryTabBox,
        entryPanelBox,
    ] = await Promise.all([
        tabs.boundingBox(),
        entryTab.boundingBox(),
        organizationTab.boundingBox(),
        historyTab.boundingBox(),
        summaryTab.boundingBox(),
        entryPanel.boundingBox(),
    ]);

    expect(tabsBox).not.toBeNull();
    expect(entryTabBox).not.toBeNull();
    expect(organizationTabBox).not.toBeNull();
    expect(historyTabBox).not.toBeNull();
    expect(summaryTabBox).not.toBeNull();
    expect(entryPanelBox).not.toBeNull();

    const tabWidths = [
        entryTabBox,
        organizationTabBox,
        historyTabBox,
        summaryTabBox,
    ].map((box) => (box as NonNullable<typeof box>).width);

    for (const width of tabWidths) {
        expect(width).toBeGreaterThan(
            (tabsBox as NonNullable<typeof tabsBox>).width * 0.18,
        );
    }

    expect(
        (entryPanelBox as NonNullable<typeof entryPanelBox>).width,
    ).toBeGreaterThan((tabsBox as NonNullable<typeof tabsBox>).width * 0.9);

    await historyTab.click();
    await expect(historyTab).toHaveClass(/freelance-tracker-app__tab--active/);
    await expect(historyPanel).toBeVisible();

    await summaryTab.click();
    await expect(summaryTab).toHaveClass(/freelance-tracker-app__tab--active/);
    await expect(summaryPanel).toBeVisible();
});

test("entry tab grouped rows keep desktop order, mobile wrapping, and no horizontal overflow", async ({
    page,
}) => {
    const entryPanel = panelForView(page, "Entry");
    await expect(entryPanel).toBeVisible();
    const viewportWidth = await getViewportWidth(page);

    const organizationInput = entryPanel.getByLabel("Organization", {
        exact: true,
    });
    const venueInput = entryPanel.getByLabel("Venue", { exact: true });
    const organizationField = fieldContainerFor(organizationInput);
    const venueField = fieldContainerFor(venueInput);
    const organizationVenueRow = rowContainerFor(organizationInput);

    await expectResponsiveEntryRowLayout(
        viewportWidth,
        organizationVenueRow,
        organizationField,
        venueField,
    );

    const startTimeInput = entryPanel.getByLabel("Start Time", { exact: true });
    const endTimeInput = entryPanel.getByLabel("End Time", { exact: true });
    const startTimeField = fieldContainerFor(startTimeInput);
    const endTimeField = fieldContainerFor(endTimeInput);
    const startEndRow = rowContainerFor(startTimeInput);

    await expectResponsiveEntryRowLayout(
        viewportWidth,
        startEndRow,
        startTimeField,
        endTimeField,
    );

    const hourlyRateInput = entryPanel.getByLabel(/hourly rate/i);
    const payModeGroup = entryPanel.locator(
        "fieldset.entry-form__payment-mode",
    );
    const hourlyRateField = fieldContainerFor(hourlyRateInput);
    const payModeField = payModeGroup;
    const payModeRow = rowContainerFor(hourlyRateInput);

    await expectResponsiveEntryRowLayout(
        viewportWidth,
        payModeRow,
        hourlyRateField,
        payModeField,
    );
});

test("organization surface is visible on desktop and navigable on mobile", async ({
    page,
    isMobile,
}) => {
    const organizationPanel = page.locator("#freelance-panel-organization");

    if (!isMobile) {
        await expect(page.locator(".freelance-tracker-app__tabs")).toBeHidden();
        await ensureView(page, isMobile, "Organization");
        await expect(
            organizationPanel.getByRole("heading", {
                name: /organizations/i,
            }),
        ).toBeVisible();
        await expect(organizationPanel).toBeVisible();
        return;
    }

    await expect(organizationPanel).not.toBeVisible();
    await page.locator("#freelance-tab-organization").click();
    await expect(organizationPanel).toBeVisible();
    await expect(page.locator("#freelance-panel-entry")).not.toBeVisible();
    await expect(page.locator("#freelance-panel-history")).not.toBeVisible();
    await expect(page.locator("#freelance-panel-summary")).not.toBeVisible();
    await expect(
        organizationPanel.getByRole("heading", { name: /organizations/i }),
    ).toBeVisible();
});

test("create entry workflow on desktop and mobile", async ({
    page,
    isMobile,
}) => {
    await expect(
        page.getByRole("heading", { name: /freelance hours tracker/i }),
    ).toBeVisible();
    await expect(
        page.getByRole("heading", { name: /new entry/i }),
    ).toBeVisible();

    await fillAndSubmitEntry(page, {
        position: "Audio Tech",
        rate: "30",
        tags: ["festival", "setup"],
    });

    const historyPanel = await ensureView(page, isMobile, "Entry History");

    await expect(historyPanel.getByText("Audio Tech").first()).toBeVisible();
    await expect(historyPanel.getByText("festival").first()).toBeVisible();
});

test("view and filter entries by tag", async ({ page, isMobile }) => {
    await fillAndSubmitEntry(page, { position: "Audio", tags: ["festival"] });
    await fillAndSubmitEntry(page, { position: "Video", tags: ["corporate"] });

    const historyPanel = await ensureView(page, isMobile, "Entry History");

    await historyPanel.getByRole("button", { name: "festival" }).click();
    await expect(historyPanel.getByText("Audio").first()).toBeVisible();

    await historyPanel.getByRole("button", { name: "All" }).click();
    await expect(historyPanel.getByText("Video").first()).toBeVisible();
});

test("edit entry workflow", async ({ page, isMobile }) => {
    await fillAndSubmitEntry(page, { position: "Old Position", rate: "20" });

    const historyPanel = await ensureView(page, isMobile, "Entry History");

    await historyPanel.getByRole("button", { name: /edit/i }).first().click();

    // On small screens, tapping Edit in history should automatically
    // activate the Entry tab without an extra tap.
    if (isMobile) {
        await expect(page.locator("#freelance-tab-entry")).toHaveClass(
            /freelance-tracker-app__tab--active/,
        );
    }

    const entryPanel = panelForView(page, "Entry");
    await expect(entryPanel).toBeVisible();
    await entryPanel
        .getByLabel("Position", { exact: true })
        .fill("Updated Position");
    await entryPanel.getByRole("button", { name: /update entry/i }).click();

    // Updating to a new position opens the create-position modal; save it and retry update.
    if (await saveNewPositionDialogIfOpen(page)) {
        await entryPanel.getByRole("button", { name: /update entry/i }).click();
    }

    const updatedHistoryPanel = await ensureView(
        page,
        isMobile,
        "Entry History",
    );
    await expect(
        updatedHistoryPanel.getByText("Updated Position").first(),
    ).toBeVisible();
});

test("delete entry workflow", async ({ page, isMobile }) => {
    await fillAndSubmitEntry(page, { position: "Delete Me", rate: "20" });

    const historyPanel = await ensureView(page, isMobile, "Entry History");

    await historyPanel
        .getByRole("button", { name: /delete/i })
        .first()
        .click();
    const deleteModal = page.locator(".entry-history__modal");
    await expect(deleteModal).toContainText(/delete entry/i);
    await deleteModal.getByRole("button", { name: /^delete$/i }).click();

    await expect(historyPanel.getByText("Delete Me")).toHaveCount(0);
});

test("pay period and gross pay calculation", async ({ page, isMobile }) => {
    await fillAndSubmitEntry(page, { position: "Shift A", rate: "20" });
    await fillAndSubmitEntry(page, { position: "Shift B", rate: "30" });

    const summaryPanel = await ensureView(page, isMobile, "Pay Summary");
    const summarySelector = summaryPanel.getByRole("group", {
        name: /summary period/i,
    });

    await summarySelector.getByRole("button", { name: /this week/i }).click();

    await expect(
        summaryPanel.getByText(/gross pay \(hourly \+ flat fee\)/i),
    ).toBeVisible();
    await expect(
        summaryPanel.locator(".pay-summary__card-label", {
            hasText: /^hours$/i,
        }),
    ).toBeVisible();
});

test("unrated entries are counted correctly", async ({ page, isMobile }) => {
    await fillAndSubmitEntry(page, { position: "Rated", rate: "40" });
    await fillAndSubmitEntry(page, { position: "Unrated" });

    const summaryPanel = await ensureView(page, isMobile, "Pay Summary");

    await expect(summaryPanel.getByText(/unrated hourly/i)).toBeVisible();
});

test("cross-org cumulative summary remains visible", async ({
    page,
    isMobile,
}) => {
    await fillAndSubmitEntry(page, { position: "Org A shift", rate: "50" });

    const summaryPanel = await ensureView(page, isMobile, "Pay Summary");

    await expect(summaryPanel.getByText(/total \(all orgs\)/i)).toBeVisible();
});

test("desktop period selectors default to This Month and change independently", async ({
    page,
    isMobile,
}) => {
    const historySelector = page.locator(
        "#freelance-panel-history .period-selector",
    );
    const summarySelector = page.locator(
        "#freelance-panel-summary .period-selector",
    );

    if (isMobile) {
        await ensureView(page, isMobile, "Entry History");
        await expect(
            historySelector.getByRole("button", { name: "This Month" }),
        ).toHaveClass(/period-selector__button--active/);

        await ensureView(page, isMobile, "Pay Summary");
        await expect(
            summarySelector.getByRole("button", { name: "This Month" }),
        ).toHaveClass(/period-selector__button--active/);

        await summarySelector
            .getByRole("button", { name: "This Week" })
            .click();
        await expect(
            summarySelector.getByRole("button", { name: "This Week" }),
        ).toHaveClass(/period-selector__button--active/);

        await ensureView(page, isMobile, "Entry History");
        await expect(
            historySelector.getByRole("button", { name: "This Month" }),
        ).toHaveClass(/period-selector__button--active/);

        await historySelector.getByRole("button", { name: "Custom" }).click();
        await historySelector.getByLabel("Start").fill("2026-03-01");
        await historySelector.getByLabel("End").fill("2026-03-31");
        await historySelector.getByRole("button", { name: "Apply" }).click();

        await expect(
            historySelector.getByRole("button", { name: "Custom" }),
        ).toHaveClass(/period-selector__button--active/);

        await ensureView(page, isMobile, "Pay Summary");
        await expect(
            summarySelector.getByRole("button", { name: "This Week" }),
        ).toHaveClass(/period-selector__button--active/);
        return;
    }

    await expect(
        historySelector.getByRole("button", { name: "This Month" }),
    ).toHaveClass(/period-selector__button--active/);
    await expect(
        summarySelector.getByRole("button", { name: "This Month" }),
    ).toHaveClass(/period-selector__button--active/);

    await summarySelector.getByRole("button", { name: "This Week" }).click();

    await expect(
        summarySelector.getByRole("button", { name: "This Week" }),
    ).toHaveClass(/period-selector__button--active/);
    await expect(
        historySelector.getByRole("button", { name: "This Month" }),
    ).toHaveClass(/period-selector__button--active/);

    await historySelector.getByRole("button", { name: "Custom" }).click();
    await historySelector.getByLabel("Start").fill("2026-03-01");
    await historySelector.getByLabel("End").fill("2026-03-31");
    await historySelector.getByRole("button", { name: "Apply" }).click();

    await expect(
        historySelector.getByRole("button", { name: "Custom" }),
    ).toHaveClass(/period-selector__button--active/);
    await expect(
        summarySelector.getByRole("button", { name: "This Week" }),
    ).toHaveClass(/period-selector__button--active/);
});

test("history and summary organization filters stay isolated through one UI journey", async ({
    page,
    isMobile,
}) => {
    const orgAlphaId = "org-alpha";
    const orgBetaId = "org-beta";

    await page.evaluate(
        ({ orgAlpha, orgBeta }) => {
            const createdAt = "2026-04-17T00:00:00.000Z";

            window.localStorage.setItem(
                "freelance-tracker:organizations",
                JSON.stringify([
                    {
                        organizationId: orgAlpha,
                        name: "Org Alpha",
                        payPeriodStartDay: 1,
                        timezone: "UTC",
                        workweekStartDay: 1,
                        createdAt,
                        venues: [],
                        positions: [],
                    },
                    {
                        organizationId: orgBeta,
                        name: "Org Beta",
                        payPeriodStartDay: 1,
                        timezone: "UTC",
                        workweekStartDay: 1,
                        createdAt,
                        venues: [],
                        positions: [],
                    },
                ]),
            );

            window.localStorage.setItem(
                "freelance-tracker:entries",
                JSON.stringify([
                    {
                        entryId: "entry-alpha",
                        organizationId: orgAlpha,
                        date: "2026-04-14",
                        startTime: "09:00",
                        endTime: "11:00",
                        venue: "",
                        position: "Alpha Shift",
                        rate: 10,
                        event: "",
                        tags: [],
                        notes: "",
                        mealPenaltyCount: 0,
                        createdAt,
                        updatedAt: createdAt,
                    },
                    {
                        entryId: "entry-beta",
                        organizationId: orgBeta,
                        date: "2026-04-15",
                        startTime: "09:00",
                        endTime: "11:00",
                        venue: "",
                        position: "Beta Shift",
                        rate: 30,
                        event: "",
                        tags: [],
                        notes: "",
                        mealPenaltyCount: 0,
                        createdAt,
                        updatedAt: createdAt,
                    },
                ]),
            );

            window.localStorage.setItem("freelance-tracker:tags", "[]");
            window.localStorage.setItem("freelance-tracker:positions", "[]");
            window.localStorage.setItem("freelance-tracker:venues", "[]");
            window.localStorage.setItem("freelance-tracker:rulesets", "[]");
        },
        { orgAlpha: orgAlphaId, orgBeta: orgBetaId },
    );

    await page.reload();
    await waitForAppReady(page);

    const historyPanel = await ensureView(page, isMobile, "Entry History");
    const historyOrgFilter = historyPanel.locator(
        "#entry-history-organization-filter",
    );
    const historyFilterToggle = historyPanel.locator(
        "#entry-history-filter-by-org",
    );
    const summaryPanel = await ensureView(page, isMobile, "Pay Summary");
    const summaryOrgFilter = summaryPanel.locator(
        "#summary-organization-filter",
    );
    const summaryFilterToggle = summaryPanel.locator(
        "#pay-summary-filter-by-org",
    );
    const summaryPeriodSelector = summaryPanel.getByRole("group", {
        name: /summary period/i,
    });
    const summaryPrimaryCard = summaryPanel.locator(
        ".pay-summary__card--primary",
    );

    await expect(historyFilterToggle).not.toBeChecked();
    await expect(historyOrgFilter.locator("option:checked")).toHaveText(
        "All organizations",
    );
    await expect(summaryFilterToggle).not.toBeChecked();
    await expect(summaryOrgFilter.locator("option:checked")).toHaveText(
        "All organizations",
    );
    await expect(summaryPrimaryCard).toContainText("$80.00");

    await ensureView(page, isMobile, "Entry History");
    await historyFilterToggle.check();
    await expect(historyOrgFilter).toBeEnabled();
    await historyOrgFilter.selectOption({ label: "Org Beta" });
    await expect(historyPanel.getByText("Beta Shift").first()).toBeVisible();
    await expect(historyPanel.getByText("Alpha Shift")).toHaveCount(0);

    await ensureView(page, isMobile, "Pay Summary");
    await expect(summaryFilterToggle).not.toBeChecked();
    await expect(summaryOrgFilter.locator("option:checked")).toHaveText(
        "All organizations",
    );
    await expect(summaryPrimaryCard).toContainText("$80.00");

    await summaryFilterToggle.check();
    await expect(summaryOrgFilter).toBeEnabled();
    await summaryOrgFilter.selectOption({ label: "Org Beta" });
    await expect(summaryPrimaryCard).toContainText("$60.00");

    await ensureView(page, isMobile, "Entry History");
    await expect(historyOrgFilter.locator("option:checked")).toHaveText(
        "Org Beta",
    );

    await ensureView(page, isMobile, "Pay Summary");
    await summaryPeriodSelector
        .getByRole("button", { name: /this week/i })
        .click();
    await expect(
        summaryPeriodSelector.getByRole("button", { name: /this week/i }),
    ).toHaveClass(/period-selector__button--active/);
    await expect(summaryOrgFilter.locator("option:checked")).toHaveText(
        "Org Beta",
    );

    await ensureView(page, isMobile, "Entry History");
    await expect(historyOrgFilter.locator("option:checked")).toHaveText(
        "Org Beta",
    );
});

test("unknown organization shows Manage Organizations prompt and opens organization pane", async ({
    page,
    isMobile,
}) => {
    const entryPanel = panelForView(page, "Entry");
    const orgInput = entryPanel.getByPlaceholder(
        /select or type organization/i,
    );

    await orgInput.fill("Org Fresh");
    await expect(
        entryPanel.getByText('No organization named "Org Fresh".'),
    ).toBeVisible();

    await entryPanel
        .getByRole("button", { name: /manage organizations/i })
        .click();

    const organizationsPanel = await ensureView(page, isMobile, "Organization");
    await expect(
        organizationsPanel.getByRole("heading", { name: /organizations/i }),
    ).toBeVisible();
});

test("duplicate organization name does not trigger manage-organizations prompt", async ({
    page,
}) => {
    await ensureOrganizationSelected(page, E2E_ORG_NAME);

    const orgInput = panelForView(page, "Entry").getByPlaceholder(
        /select or type organization/i,
    );
    await orgInput.fill(`  ${E2E_ORG_NAME}  `);
    await expect(
        panelForView(page, "Entry").getByRole("button", {
            name: /manage organizations/i,
        }),
    ).toHaveCount(0);
});

test("single-column entry layout combo boxes let users choose existing organization venue and position without typing", async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => {
        window.localStorage.setItem(
            "freelance-tracker:organizations",
            JSON.stringify([
                {
                    organizationId: "org-a",
                    name: "Org A",
                    payPeriodStartDay: 1,
                    timezone: "UTC",
                    workweekStartDay: 1,
                    notes: null,
                    positions: [{ name: "Audio Tech", defaultRate: 35 }],
                    venues: ["City Hall"],
                    createdAt: "2026-04-17T00:00:00.000Z",
                },
                {
                    organizationId: "org-b",
                    name: "Org B",
                    payPeriodStartDay: 1,
                    timezone: "UTC",
                    workweekStartDay: 1,
                    notes: null,
                    positions: [{ name: "Stage Manager", defaultRate: null }],
                    venues: ["Civic Center"],
                    createdAt: "2026-04-17T00:00:00.000Z",
                },
            ]),
        );
        window.localStorage.setItem("freelance-tracker:entries", "[]");
        window.localStorage.setItem("freelance-tracker:tags", "[]");
        window.localStorage.setItem("freelance-tracker:positions", "[]");
        window.localStorage.setItem("freelance-tracker:venues", "[]");
        window.localStorage.setItem("freelance-tracker:rulesets", "[]");
    });
    await page.reload();
    await waitForAppReady(page);

    const entryPanel = panelForView(page, "Entry");
    await expect(entryPanel).toBeVisible();

    await entryPanel
        .getByRole("button", { name: /show organization options/i })
        .click();
    await entryPanel.getByRole("option", { name: "Org B" }).click();
    await expect(
        entryPanel.getByLabel("Organization", { exact: true }),
    ).toHaveValue("Org B");

    await entryPanel
        .getByRole("button", { name: /show venue options/i })
        .click();
    await entryPanel.getByRole("option", { name: "Civic Center" }).click();
    await expect(entryPanel.getByLabel("Venue", { exact: true })).toHaveValue(
        "Civic Center",
    );

    await entryPanel
        .getByRole("button", { name: /show position options/i })
        .click();
    await entryPanel.getByRole("option", { name: "Stage Manager" }).click();
    await expect(
        entryPanel.getByLabel("Position", { exact: true }),
    ).toHaveValue("Stage Manager");
});

test("ruleset authoring creates an active ruleset with edited rule lines", async ({
    page,
    isMobile,
}) => {
    await createRulesetWithDailyOtAndCustomTagBonus(page, isMobile);

    const rulesetsPanel = await openRulesetsPanel(page, isMobile);
    const activeCard = rulesetsPanel
        .locator(".ruleset-editor__card--active")
        .first();
    await expect(activeCard).toContainText("Effective 04/01/2026");
    await expect(activeCard).toContainText("Active");
    await expect(activeCard).toContainText("Daily OT 1.5x");
    await expect(activeCard).toContainText("Night Bonus");
});

test("ruleset flow supports create edit and delete", async ({
    page,
    isMobile,
}) => {
    const rulesetsPanel = await openRulesetsPanel(page, isMobile);

    await rulesetsPanel
        .getByRole("button", { name: /\+ new ruleset/i })
        .click();

    await rulesetsPanel
        .getByLabel(/ruleset effective date/i)
        .fill("2026-04-20");
    await rulesetsPanel.getByRole("button", { name: "Daily OT" }).click();

    await rulesetsPanel.getByPlaceholder(/daily ot/i).fill("Org Modal OT v1");
    await rulesetsPanel.getByLabel(/daily threshold hours/i).fill("8");
    await rulesetsPanel.getByLabel(/overtime multiplier/i).fill("1.5");

    await rulesetsPanel.getByRole("button", { name: /save ruleset/i }).click();

    const createdCard = rulesetsPanel.locator(
        '[data-testid="ruleset-card"][data-effective-date="2026-04-20"]',
    );
    await expect(createdCard).toContainText("Org Modal OT v1");

    await createdCard.click();
    await expect(
        rulesetsPanel.getByRole("heading", { name: /edit ruleset/i }),
    ).toBeVisible();

    await rulesetsPanel.getByPlaceholder(/daily ot/i).fill("Org Modal OT v2");
    await rulesetsPanel
        .getByRole("button", { name: /update ruleset/i })
        .click();

    const updatedCard = rulesetsPanel.locator(
        '[data-testid="ruleset-card"][data-effective-date="2026-04-20"]',
    );
    await expect(updatedCard).toContainText("Org Modal OT v2");
    await expect(updatedCard).not.toContainText("Org Modal OT v1");

    await updatedCard.click();
    await expect(
        rulesetsPanel.getByRole("heading", { name: /edit ruleset/i }),
    ).toBeVisible();

    await rulesetsPanel.getByRole("button", { name: /^delete$/i }).click();

    await expect(
        rulesetsPanel.locator(
            '[data-testid="ruleset-card"][data-effective-date="2026-04-20"]',
        ),
    ).toHaveCount(0);
});

test("ruleset authoring blocks invalid config, then saves after correction", async ({
    page,
    isMobile,
}) => {
    const rulesetsPanel = await openNewRuleset(page, isMobile);

    await rulesetsPanel
        .getByLabel(/ruleset effective date/i)
        .fill("2026-04-01");
    await rulesetsPanel.getByRole("button", { name: /save ruleset/i }).click();
    await expect(rulesetsPanel.locator(".ruleset-editor__error")).toContainText(
        /add at least one rule before saving/i,
    );

    await rulesetsPanel.getByRole("button", { name: /^\+ Custom$/i }).click();

    const customRow = rulesetsPanel.locator(".ruleset-editor__rule-row").last();
    await customRow
        .getByPlaceholder(/label shown in pay summary/i)
        .fill("Festival Bonus");

    await rulesetsPanel.getByRole("button", { name: /save ruleset/i }).click();
    await expect(rulesetsPanel.locator(".ruleset-editor__error")).toContainText(
        /require at least one matches value/i,
    );

    await customRow.getByLabel(/custom rule matches value/i).fill("festival");
    await customRow.getByLabel(/custom rule multiplier value/i).fill("1.1");

    await rulesetsPanel.getByRole("button", { name: /save ruleset/i }).click();
    const activeCard = rulesetsPanel
        .locator(".ruleset-editor__card--active")
        .first();
    await expect(activeCard).toContainText("Festival Bonus");
});

test("pay summary renders ruleset premium lines and additive warning", async ({
    page,
    isMobile,
}) => {
    await createRulesetWithDailyOtAndCustomTagBonus(page, isMobile);

    await ensureView(page, isMobile, "Entry");
    await fillAndSubmitEntry(page, {
        position: "Audio Tech",
        dateWorked: "2026-04-16",
        startTime: "09:00",
        endTime: "19:00",
        rate: "30",
        tags: ["night"],
    });

    const summaryPanel = await ensureView(page, isMobile, "Pay Summary");
    await filterSummaryToOrganization(summaryPanel, E2E_ORG_NAME);

    const dailyOtLine = summaryPanel
        .locator(".pay-summary__rule-line")
        .filter({ hasText: "Daily OT 1.5x" });
    const customLine = summaryPanel
        .locator(".pay-summary__rule-line")
        .filter({ hasText: "Night Bonus" });
    const totalCard = summaryPanel.locator(".pay-summary__card--total");

    await expect(dailyOtLine).toContainText("2.00h");
    await expect(dailyOtLine).toContainText("+$30.00");
    await expect(customLine).toContainText("10.00h");
    await expect(customLine).toContainText("+$75.00");
    await expect(totalCard).toContainText(/with premiums/i);
    await expect(totalCard).toContainText("$405.00");
    await expect(summaryPanel.getByRole("alert")).toContainText(
        /subject to multiple rules \(additive\)/i,
    );
});

test("flat-fee critical journey covers styling, derived rates, and premium-on-top totals", async ({
    page,
    isMobile,
}) => {
    await createRulesetWithDailyOtAndCustomTagBonus(page, isMobile);

    await ensureView(page, isMobile, "Entry");
    await fillAndSubmitEntry(page, {
        position: "Flat Fee OT Shift",
        dateWorked: "2026-04-16",
        startTime: "09:00",
        endTime: "19:00",
        paymentMode: "flat-fee",
        flatFeeAmount: "305",
    });

    const historyPanel = await ensureView(page, isMobile, "Entry History");
    const overtimeRow = historyPanel
        .locator("tr", { hasText: "Flat Fee OT Shift" })
        .first();

    await expect(overtimeRow).toHaveClass(/entry-history__row--flat-fee/);
    await expect(overtimeRow).toContainText("Flat Fee");
    await expect(overtimeRow).toContainText("$30.50/hr");

    const summaryPanel = await ensureView(page, isMobile, "Pay Summary");
    await filterSummaryToOrganization(summaryPanel, E2E_ORG_NAME);
    const dailyOtLine = summaryPanel
        .locator(".pay-summary__rule-line")
        .filter({ hasText: "Daily OT 1.5x" });
    const totalCard = summaryPanel.locator(".pay-summary__card--total");

    await expect(dailyOtLine).toContainText("+$30.50");
    await expect(totalCard).toContainText(/with premiums/i);
    await expect(totalCard).toContainText("$335.50");
});
