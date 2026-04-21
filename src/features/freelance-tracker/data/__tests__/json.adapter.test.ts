import { beforeEach, describe, expect, it } from "vitest";
import { JsonDataLayer } from "../adapters/json.adapter";
import {
    makeEntry,
    makeOrganization,
    testId,
    toAdapterCreateEntryInput,
} from "../../test-utils/fixtures";

function attachLocalStorage() {
    const localStorage = window.localStorage;
    localStorage.clear();
    Object.defineProperty(globalThis, "localStorage", {
        value: localStorage,
        configurable: true,
    });
    return localStorage;
}

describe("JsonDataLayer repositories", () => {
    beforeEach(() => {
        attachLocalStorage();
    });

    it("creates an entry with generated branded id and timestamps", async () => {
        const dal = new JsonDataLayer();
        const org = await dal.organizations.create({
            name: "Org A",
            payPeriodStartDay: 1,
            timezone: "UTC",
            workweekStartDay: 1,
        });
        expect(org.success).toBe(true);

        const entryInput = {
            ...toAdapterCreateEntryInput(
                makeEntry({
                    organizationId: org.success
                        ? org.data.organizationId
                        : testId("org"),
                }),
            ),
            organizationId: org.success
                ? org.data.organizationId
                : testId("org"),
        } as any;

        const created = await dal.entries.create(entryInput);

        expect(created.success).toBe(true);
        if (!created.success) return;
        expect(created.data.entryId).toMatch(/^entry-/);
        expect(created.data.createdAt).toMatch(/T/);
        expect(created.data.updatedAt).toMatch(/T/);
    });

    it("rejects invalid entry payload during create", async () => {
        const dal = new JsonDataLayer();
        const created = await dal.entries.create({
            organizationId: "org-abc" as any,
            date: "14-04-2026",
            startTime: "09:00",
            endTime: "10:00",
            position: "Tech",
            rate: 10,
            event: "Event",
            tags: [],
            notes: "",
        } as any);

        expect(created.success).toBe(false);
        if (created.success) return;
        expect(created.error.type).toBe("validation");
    });

    it("lists entries for organization and date range inclusively", async () => {
        const dal = new JsonDataLayer();
        const org = await dal.organizations.create({
            name: "Boundary Org",
            payPeriodStartDay: 1,
            timezone: "UTC",
            workweekStartDay: 1,
        });
        if (!org.success) throw new Error("org create failed");

        const orgId = org.data.organizationId;

        await dal.entries.create({
            organizationId: orgId,
            date: "2026-04-13",
            startTime: "09:00",
            endTime: "10:00",
            position: "A",
            rate: 20,
            event: "E1",
            tags: ["x"],
            notes: "n",
        } as any);
        await dal.entries.create({
            organizationId: orgId,
            date: "2026-04-19",
            startTime: "09:00",
            endTime: "10:00",
            position: "B",
            rate: 20,
            event: "E2",
            tags: ["y"],
            notes: "n",
        } as any);

        const list = await dal.entries.list({
            organizationId: orgId,
            startDate: "2026-04-13",
            endDate: "2026-04-19",
        });

        expect(list.success).toBe(true);
        if (!list.success) return;
        expect(list.data).toHaveLength(2);
    });

    it("updates entry while preserving immutable fields", async () => {
        const dal = new JsonDataLayer();
        const org = await dal.organizations.create({
            name: "Update Org",
            payPeriodStartDay: 1,
            timezone: "UTC",
            workweekStartDay: 1,
        });
        if (!org.success) throw new Error("org create failed");

        const created = await dal.entries.create({
            organizationId: org.data.organizationId,
            date: "2026-04-14",
            startTime: "09:00",
            endTime: "10:00",
            position: "Tech",
            rate: 20,
            event: "E",
            tags: ["a"],
            notes: "n",
        } as any);
        if (!created.success) throw new Error("entry create failed");

        const updated = await dal.entries.update(created.data.entryId, {
            position: "Lead",
            createdAt: "1999-01-01T00:00:00.000Z",
            entryId: "entry-hack" as any,
        } as any);

        expect(updated.success).toBe(true);
        if (!updated.success) return;
        expect(updated.data.entryId).toBe(created.data.entryId);
        expect(updated.data.createdAt).toBe(created.data.createdAt);
        expect(updated.data.position).toBe("Lead");
        expect(updated.data.updatedAt).not.toBe(created.data.updatedAt);
    });

    it("returns notFound when deleting unknown entry", async () => {
        const dal = new JsonDataLayer();
        const result = await dal.entries.delete("entry-missing" as any);
        expect(result.success).toBe(false);
        if (result.success) return;
        expect(result.error.type).toBe("notFound");
    });

    it("creates and validates organizations", async () => {
        const dal = new JsonDataLayer();
        const good = await dal.organizations.create({
            name: "Org Valid",
            payPeriodStartDay: 7,
            timezone: "UTC",
            workweekStartDay: 1,
            notes: "## House notes\n\nUse dock 2.",
        });
        expect(good.success).toBe(true);
        if (good.success) {
            expect(good.data.notes).toBe("## House notes\n\nUse dock 2.");
        }

        const bad = await dal.organizations.create({
            name: "Org Invalid",
            payPeriodStartDay: 9,
        } as any);
        expect(bad.success).toBe(false);
    });

    it("defaults legacy-compatible organization fields when omitted", async () => {
        const dal = new JsonDataLayer();

        const created = await dal.organizations.create({
            name: "Legacy Compatible Org",
            payPeriodStartDay: 3,
        } as any);

        expect(created.success).toBe(true);
        if (!created.success) return;

        expect(created.data.timezone).toBe("UTC");
        expect(created.data.workweekStartDay).toBe(1);
        expect(created.data.notes).toBeNull();
        expect(created.data.venues).toEqual([]);
        expect(created.data.positions).toEqual([]);
        expect(created.data.rulesetIds).toEqual([]);
    });

    it("updates organization catalogs by replacing positions and venues arrays", async () => {
        const dal = new JsonDataLayer();
        const created = await dal.organizations.create({
            name: "Catalog Org",
            payPeriodStartDay: 1,
            timezone: "UTC",
            workweekStartDay: 1,
            notes: null,
            venues: ["Hall A", "Hall B"],
            positions: [
                { name: "Audio", defaultRate: 40 },
                { name: "Lighting", defaultRate: 45 },
            ],
        });
        if (!created.success) throw new Error("org create failed");

        const updated = await dal.organizations.update(
            created.data.organizationId,
            {
                notes: "Keep **markdown** intact.",
                venues: ["Hall B"],
                positions: [{ name: "Lighting", defaultRate: 50 }],
            },
        );

        expect(updated.success).toBe(true);
        if (!updated.success) return;

        expect(updated.data.notes).toBe("Keep **markdown** intact.");
        expect(updated.data.venues).toEqual(["Hall B"]);
        expect(updated.data.positions).toEqual([
            { name: "Lighting", defaultRate: 50 },
        ]);
    });

    it("rehydrates legacy persisted organizations without optional fields", async () => {
        const storage = attachLocalStorage();
        storage.setItem(
            "freelance-tracker:organizations",
            JSON.stringify([
                {
                    organizationId: testId("org"),
                    name: "Persisted Org",
                    payPeriodStartDay: 2,
                    createdAt: "2026-04-14T10:00:00.000Z",
                },
            ]),
        );

        const dal = new JsonDataLayer();
        const listed = await dal.organizations.list();

        expect(listed.success).toBe(true);
        if (!listed.success) return;

        expect(listed.data[0]).toMatchObject({
            timezone: "UTC",
            workweekStartDay: 1,
            notes: null,
            venues: [],
            positions: [],
            rulesetIds: [],
        });
    });

    it("associates a newly created ruleset to the provided organization without persisting org ownership on the ruleset", async () => {
        const dal = new JsonDataLayer();
        const organization = await dal.organizations.create({
            name: "Ruleset Org",
            payPeriodStartDay: 1,
            timezone: "UTC",
            workweekStartDay: 1,
        });
        if (!organization.success)
            throw new Error("organization create failed");

        const createdRuleset = await dal.rulesets.create({
            organizationId: organization.data.organizationId,
            effectiveDate: "2026-04-01",
            rules: [],
        });

        expect(createdRuleset.success).toBe(true);
        if (!createdRuleset.success) return;
        expect(createdRuleset.data.organizationId).toBeUndefined();

        const refreshedOrganization = await dal.organizations.get(
            organization.data.organizationId,
        );
        expect(refreshedOrganization.success).toBe(true);
        if (!refreshedOrganization.success) return;
        expect(refreshedOrganization.data.rulesetIds).toEqual([
            createdRuleset.data.rulesetId,
        ]);

        const listedRulesets = await dal.rulesets.listByOrg(
            organization.data.organizationId,
        );
        expect(listedRulesets.success).toBe(true);
        if (!listedRulesets.success) return;
        expect(listedRulesets.data.map((ruleset) => ruleset.rulesetId)).toEqual(
            [createdRuleset.data.rulesetId],
        );
    });

    it("rehydrates legacy ruleset ownership into organization rulesetIds", async () => {
        const storage = attachLocalStorage();
        storage.setItem(
            "freelance-tracker:organizations",
            JSON.stringify([
                {
                    organizationId: "org-legacy001",
                    name: "Legacy Org",
                    payPeriodStartDay: 1,
                    timezone: "UTC",
                    workweekStartDay: 1,
                    createdAt: "2026-04-01T00:00:00.000Z",
                    venues: [],
                    positions: [],
                },
            ]),
        );
        storage.setItem(
            "freelance-tracker:rulesets",
            JSON.stringify([
                {
                    rulesetId: "ruleset-legacy001",
                    organizationId: "org-legacy001",
                    effectiveDate: "2026-04-01",
                    rules: [],
                    createdAt: "2026-04-01T00:00:00.000Z",
                },
            ]),
        );

        const dal = new JsonDataLayer();

        const organization = await dal.organizations.get(
            "org-legacy001" as any,
        );
        expect(organization.success).toBe(true);
        if (!organization.success) return;
        expect(organization.data.rulesetIds).toEqual(["ruleset-legacy001"]);

        const rulesets = await dal.rulesets.listByOrg("org-legacy001" as any);
        expect(rulesets.success).toBe(true);
        if (!rulesets.success) return;
        expect(rulesets.data[0]?.organizationId).toBeUndefined();
    });

    it("removes organization references when deleting a shared ruleset", async () => {
        const dal = new JsonDataLayer();
        const organization = await dal.organizations.create({
            name: "Delete Ruleset Org",
            payPeriodStartDay: 1,
            timezone: "UTC",
            workweekStartDay: 1,
        });
        if (!organization.success)
            throw new Error("organization create failed");

        const createdRuleset = await dal.rulesets.create({
            organizationId: organization.data.organizationId,
            effectiveDate: "2026-04-01",
            rules: [],
        });
        if (!createdRuleset.success) throw new Error("ruleset create failed");

        const deleted = await dal.rulesets.delete(
            createdRuleset.data.rulesetId,
        );
        expect(deleted.success).toBe(true);

        const refreshedOrganization = await dal.organizations.get(
            organization.data.organizationId,
        );
        expect(refreshedOrganization.success).toBe(true);
        if (!refreshedOrganization.success) return;
        expect(refreshedOrganization.data.rulesetIds).toEqual([]);
    });

    it("lists all shared rulesets in effective-date order for assignment selection", async () => {
        const dal = new JsonDataLayer();
        const orgA = await dal.organizations.create({
            name: "Ruleset List Org A",
            payPeriodStartDay: 1,
            timezone: "UTC",
            workweekStartDay: 1,
        });
        const orgB = await dal.organizations.create({
            name: "Ruleset List Org B",
            payPeriodStartDay: 1,
            timezone: "UTC",
            workweekStartDay: 1,
        });
        if (!orgA.success || !orgB.success) {
            throw new Error("organization create failed");
        }

        const sharedLatest = await dal.rulesets.create({
            organizationId: orgA.data.organizationId,
            effectiveDate: "2026-06-01",
            rules: [],
        });
        const sharedMiddle = await dal.rulesets.create({
            organizationId: orgB.data.organizationId,
            effectiveDate: "2026-05-01",
            rules: [],
        });
        const unassociatedOldest = await dal.rulesets.create({
            effectiveDate: "2026-04-01",
            rules: [],
        });

        if (
            !sharedLatest.success ||
            !sharedMiddle.success ||
            !unassociatedOldest.success
        ) {
            throw new Error("ruleset create failed");
        }

        const listed = await dal.rulesets.listAll();
        expect(listed.success).toBe(true);
        if (!listed.success) return;

        expect(listed.data.map((ruleset) => ruleset.rulesetId)).toEqual([
            sharedLatest.data.rulesetId,
            sharedMiddle.data.rulesetId,
            unassociatedOldest.data.rulesetId,
        ]);
    });

    it("refreshes organization and entry reads after localStorage is reseeded", async () => {
        const storage = attachLocalStorage();
        storage.setItem(
            "freelance-tracker:organizations",
            JSON.stringify([
                {
                    organizationId: "org-baseline",
                    name: "Baseline Org",
                    payPeriodStartDay: 1,
                    timezone: "UTC",
                    workweekStartDay: 1,
                    createdAt: "2026-04-17T00:00:00.000Z",
                    venues: [],
                    positions: [],
                },
            ]),
        );
        storage.setItem("freelance-tracker:entries", "[]");

        const dal = new JsonDataLayer();

        const baselineOrgs = await dal.organizations.list();
        expect(baselineOrgs.success).toBe(true);
        if (!baselineOrgs.success) return;
        expect(baselineOrgs.data).toHaveLength(1);

        storage.setItem(
            "freelance-tracker:organizations",
            JSON.stringify([
                {
                    organizationId: "org-alpha",
                    name: "Org Alpha",
                    payPeriodStartDay: 1,
                    timezone: "UTC",
                    workweekStartDay: 1,
                    createdAt: "2026-04-17T00:00:00.000Z",
                    venues: [],
                    positions: [],
                },
                {
                    organizationId: "org-beta",
                    name: "Org Beta",
                    payPeriodStartDay: 1,
                    timezone: "UTC",
                    workweekStartDay: 1,
                    createdAt: "2026-04-17T00:00:00.000Z",
                    venues: [],
                    positions: [],
                },
            ]),
        );
        storage.setItem(
            "freelance-tracker:entries",
            JSON.stringify([
                {
                    entryId: "entry-alpha",
                    organizationId: "org-alpha",
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
                    createdAt: "2026-04-17T00:00:00.000Z",
                    updatedAt: "2026-04-17T00:00:00.000Z",
                },
                {
                    entryId: "entry-beta",
                    organizationId: "org-beta",
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
                    createdAt: "2026-04-17T00:00:00.000Z",
                    updatedAt: "2026-04-17T00:00:00.000Z",
                },
            ]),
        );

        const reseededOrgs = await dal.organizations.list();
        expect(reseededOrgs.success).toBe(true);
        if (!reseededOrgs.success) return;
        expect(reseededOrgs.data.map((org) => org.name)).toEqual([
            "Org Alpha",
            "Org Beta",
        ]);

        const alphaEntries = await dal.entries.list({
            organizationId: "org-alpha" as any,
            startDate: "2026-04-01",
            endDate: "2026-04-30",
        });
        expect(alphaEntries.success).toBe(true);
        if (!alphaEntries.success) return;
        expect(alphaEntries.data).toHaveLength(1);
        expect(alphaEntries.data[0].position).toBe("Alpha Shift");

        const betaEntries = await dal.entries.list({
            organizationId: "org-beta" as any,
            startDate: "2026-04-01",
            endDate: "2026-04-30",
        });
        expect(betaEntries.success).toBe(true);
        if (!betaEntries.success) return;
        expect(betaEntries.data).toHaveLength(1);
        expect(betaEntries.data[0].position).toBe("Beta Shift");
    });

    it("records tags case-insensitively and increments count", async () => {
        const dal = new JsonDataLayer();
        const first = await dal.tags.record("Audio");
        const second = await dal.tags.record("audio");

        expect(first.success).toBe(true);
        expect(second.success).toBe(true);

        const all = await dal.tags.getAll();
        expect(all.success).toBe(true);
        if (!all.success) return;
        expect(all.data).toHaveLength(1);
        expect(all.data[0].count).toBe(2);
    });

    it("scopes positions and venues by organization", async () => {
        const dal = new JsonDataLayer();
        const orgA = testId("org");
        const orgB = testId("org");

        await dal.positions.record(orgA, "Engineer");
        await dal.positions.record(orgB, "Engineer");
        await dal.venues.record(orgA, "Hall A");
        await dal.venues.record(orgB, "Hall B");

        const posA = await dal.positions.getByOrg(orgA);
        const posB = await dal.positions.getByOrg(orgB);
        const venueA = await dal.venues.getByOrg(orgA);

        expect(posA.success && posA.data.length === 1).toBe(true);
        expect(posB.success && posB.data.length === 1).toBe(true);
        expect(venueA.success && venueA.data[0].venueName === "Hall A").toBe(
            true,
        );
    });

    it("commits successful transactions", async () => {
        const dal = new JsonDataLayer();
        const org = await dal.organizations.create({
            name: "Tx Org",
            payPeriodStartDay: 1,
            timezone: "UTC",
            workweekStartDay: 1,
        });
        if (!org.success) throw new Error("org create failed");

        const txResult = await dal.transaction.transaction(async (tx) => {
            await tx.tags.record("tx-tag");
            await tx.positions.record(org.data.organizationId, "Mixer");
            await tx.entries.create({
                organizationId: org.data.organizationId,
                date: "2026-04-16",
                startTime: "09:00",
                endTime: "10:00",
                position: "Mixer",
                rate: 40,
                event: "TX",
                tags: ["tx-tag"],
                notes: "tx",
            } as any);

            return { success: true, data: "done" } as any;
        });

        expect((txResult as any).success).toBeTruthy();

        const tags = await dal.tags.getAll();
        const entries = await dal.entries.list({
            organizationId: org.data.organizationId,
            startDate: "2026-04-01",
            endDate: "2026-04-30",
        });

        expect(tags.success && tags.data.length).toBe(1);
        expect(entries.success && entries.data.length).toBe(1);
    });

    it("rolls back transaction when rollback is flagged", async () => {
        const dal = new JsonDataLayer();
        const orgId = testId("org");

        const txResult = await dal.transaction.transaction(async (tx) => {
            await tx.positions.record(orgId, "Failing Position");
            tx.rollback("forced");
            return { success: true, data: null } as any;
        });

        expect((txResult as any).success).toBe(false);

        const positions = await dal.positions.getByOrg(orgId);
        expect(positions.success).toBe(true);
        if (!positions.success) return;
        expect(positions.data).toHaveLength(0);
    });

    it("initialize and dispose load/save localStorage lifecycle", async () => {
        const storage = attachLocalStorage();
        const persistedOrg = makeOrganization();
        storage.setItem(
            "freelance-tracker:organizations",
            JSON.stringify([persistedOrg]),
        );

        const dal = new JsonDataLayer();
        const init = await dal.initialize();
        expect(init.success).toBe(true);

        const listed = await dal.organizations.list();
        expect(listed.success).toBe(true);
        if (!listed.success) return;
        expect(listed.data.length).toBe(1);

        await dal.dispose();
        const raw = storage.getItem("freelance-tracker:organizations");
        expect(raw).toContain(persistedOrg.organizationId);
    });
});
