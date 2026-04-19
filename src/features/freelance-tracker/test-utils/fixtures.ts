import type {
    Entry,
    Id,
    Organization,
    Ruleset,
    Rule,
} from "../contracts/types";

let seq = 0;

export function testId(prefix = "id"): Id {
    seq += 1;
    return `${prefix}-${String(seq).padStart(4, "0")}` as Id;
}

export function makeOrganization(
    overrides: Partial<Organization> = {},
): Organization {
    return {
        organizationId: testId("org"),
        name: "Acme Production",
        payPeriodStartDay: 1,
        timezone: "UTC",
        workweekStartDay: 1,
        notes: null,
        venues: [],
        positions: [],
        createdAt: "2026-04-14T10:00:00.000Z",
        ...overrides,
    };
}

export function makeEntry(overrides: Partial<Entry> = {}): Entry {
    const organizationId = (overrides.organizationId ?? testId("org")) as Id;

    return {
        entryId: testId("entry"),
        organizationId,
        dateWorked: "2026-04-14",
        startTime: "09:00",
        endTime: "11:00",
        venue: null,
        position: "Audio Tech",
        rate: 20,
        event: "Soundcheck",
        tags: ["audio"],
        notes: "notes",
        mealPenaltyCount: 0,
        createdAt: "2026-04-14T10:00:00.000Z",
        updatedAt: "2026-04-14T10:00:00.000Z",
        ...overrides,
    };
}

export function makeRuleset(
    overrides: Partial<Ruleset> & { rules?: Rule[] } = {},
): Ruleset {
    return {
        rulesetId: testId("ruleset"),
        organizationId: testId("org"),
        effectiveDate: "2026-04-01",
        rules: [],
        createdAt: "2026-04-01T00:00:00.000Z",
        ...overrides,
    };
}

export function toAdapterCreateEntryInput(
    entry: Entry,
): Record<string, unknown> {
    return {
        organizationId: entry.organizationId,
        date: entry.dateWorked,
        startTime: entry.startTime,
        endTime: entry.endTime,
        position: entry.position,
        rate: entry.rate,
        event: entry.event,
        tags: entry.tags,
        notes: entry.notes,
    };
}
