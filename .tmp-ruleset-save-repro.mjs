import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

page.on('console', (msg) => console.log('console:', msg.type(), msg.text()));
page.on('pageerror', (err) => console.log('pageerror:', err.stack || err.message));
page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) {
        console.log('navigated:', frame.url());
    }
});

await page.goto('http://127.0.0.1:4174/');
await page.evaluate(() => {
    window.localStorage.clear();
    const org = {
        organizationId: 'org-e2edefault',
        name: 'E2E Organization',
        payPeriodStartDay: 1,
        timezone: 'UTC',
        workweekStartDay: 1,
        createdAt: '2026-04-17T00:00:00.000Z',
        venues: [],
        positions: [],
    };

    window.localStorage.setItem('freelance-tracker:organizations', JSON.stringify([org]));
    window.localStorage.setItem('freelance-tracker:entries', '[]');
    window.localStorage.setItem('freelance-tracker:tags', '[]');
    window.localStorage.setItem('freelance-tracker:positions', '[]');
    window.localStorage.setItem('freelance-tracker:venues', '[]');
    window.localStorage.setItem('freelance-tracker:rulesets', '[]');
});
await page.reload();

const leftTab = page.locator('.freelance-tracker-app__left-tabs').getByRole('button', { name: 'Organization', exact: true });
await leftTab.click();
const organizationPanel = page.locator('#freelance-panel-organization');
await organizationPanel.getByRole('button', { name: 'E2E Organization', exact: true }).click();
const dialog = page.getByTestId('organization-details-dialog');
console.log('initial pay rulesets heading count', await dialog.getByRole('heading', { name: /pay rulesets/i }).count());
await dialog.getByRole('button', { name: /\+ new ruleset/i }).click();
await dialog.getByLabel(/ruleset effective date/i).fill('2026-04-01');
await dialog.getByRole('button', { name: 'Daily OT' }).click();
const overtimeFields = dialog.locator('.ruleset-editor__rule-fields').first();
await overtimeFields.getByPlaceholder(/daily ot/i).fill('Daily OT 1.5x');
await overtimeFields.getByLabel(/daily threshold hours/i).fill('8');
await overtimeFields.getByLabel(/overtime multiplier/i).fill('1.5');
await dialog.getByRole('button', { name: /^\+ Custom$/i }).click();
const customRow = dialog.locator('.ruleset-editor__rule-row').last();
await customRow.getByPlaceholder(/label shown in pay summary/i).fill('Night Bonus');
await customRow.getByLabel(/custom rule scope/i).selectOption('tag');
await customRow.getByLabel(/custom rule matches value/i).fill('night');
await customRow.getByLabel(/custom rule multiplier value/i).fill('1.25');
await dialog.getByRole('button', { name: /save ruleset/i }).click();
for (const delay of [0, 100, 500, 1000, 3000]) {
    if (delay > 0) {
        await page.waitForTimeout(delay);
    }

    console.log(
        'delay',
        delay,
        'new ruleset heading',
        await dialog.getByRole('heading', { name: /new ruleset/i }).count(),
        'pay rulesets heading',
        await dialog.getByRole('heading', { name: /pay rulesets/i }).count(),
        'saving buttons',
        await dialog.getByRole('button', { name: /saving/i }).count(),
        'ruleset cards',
        await dialog.locator('.ruleset-card').count(),
    );
}

console.log('rulesets storage', await page.evaluate(() => window.localStorage.getItem('freelance-tracker:rulesets')));
await browser.close();
