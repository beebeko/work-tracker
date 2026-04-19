import { chromium } from "@playwright/test";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

page.on("console", (msg) => console.log("console:", msg.type(), msg.text()));
page.on("pageerror", (err) =>
    console.log("pageerror:", err.stack || err.message),
);
page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) {
        console.log("navigated:", frame.url());
    }
});

await page.goto("http://127.0.0.1:4174/");
await page.evaluate(() => {
    window.localStorage.clear();
    const org = {
        organizationId: "org-e2edefault",
        name: "E2E Organization",
        payPeriodStartDay: 1,
        timezone: "UTC",
        workweekStartDay: 1,
        createdAt: "2026-04-17T00:00:00.000Z",
        venues: [],
        positions: [],
    };

    window.localStorage.setItem(
        "freelance-tracker:organizations",
        JSON.stringify([org]),
    );
    window.localStorage.setItem("freelance-tracker:entries", "[]");
    window.localStorage.setItem("freelance-tracker:tags", "[]");
    window.localStorage.setItem("freelance-tracker:positions", "[]");
    window.localStorage.setItem("freelance-tracker:venues", "[]");
    window.localStorage.setItem("freelance-tracker:rulesets", "[]");
});
await page.reload();

const entryPanel = page.locator("#freelance-panel-entry");
await entryPanel
    .getByPlaceholder(/select or type organization/i)
    .fill("E2E Organization");
await entryPanel.getByPlaceholder(/select or type organization/i).blur();
await entryPanel.getByLabel("Position", { exact: true }).fill("Audio Tech");
await entryPanel.getByLabel("Date", { exact: true }).fill("2026-04-16");
await entryPanel.getByLabel("Start Time", { exact: true }).fill("09:00");
await entryPanel.getByLabel("End Time", { exact: true }).fill("11:00");
await entryPanel.getByLabel(/Hourly Rate/).fill("30");
await entryPanel.getByLabel("Tags", { exact: true }).fill("festival");
await entryPanel.getByLabel("Tags", { exact: true }).press("Enter");
await entryPanel.getByLabel("Tags", { exact: true }).fill("setup");
await entryPanel.getByLabel("Tags", { exact: true }).press("Enter");
await entryPanel.getByRole("button", { name: /create entry/i }).click();

const dialog = page.getByRole("dialog", { name: /new position for/i });
console.log("before save count", await dialog.count());
await dialog.getByRole("button", { name: /^save$/i }).click();
console.log("after save dialog count", await dialog.count());

await entryPanel.getByRole("button", { name: /create entry/i }).click();
await page.waitForTimeout(500);

const historyPanel = page.locator("#freelance-panel-history");
console.log(
    "history audio count",
    await historyPanel.getByText("Audio Tech").count(),
);
console.log(
    "history festival count",
    await historyPanel.getByText("festival").count(),
);
console.log(
    "create prompt count",
    await entryPanel.getByRole("button", { name: /create position/i }).count(),
);
console.log(
    "organizations storage",
    await page.evaluate(() =>
        window.localStorage.getItem("freelance-tracker:organizations"),
    ),
);
console.log(
    "entries storage",
    await page.evaluate(() =>
        window.localStorage.getItem("freelance-tracker:entries"),
    ),
);

await browser.close();
