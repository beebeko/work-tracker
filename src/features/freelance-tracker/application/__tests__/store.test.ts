import { beforeEach, describe, expect, it, vi } from "vitest";
import { testId } from "../../test-utils/fixtures";

const mocks = vi.hoisted(() => ({
    mockOrganizationsList: vi.fn(),
    mockOrganizationsCreate: vi.fn(),
    mockOrganizationsGet: vi.fn(),
    mockOrganizationsUpdate: vi.fn(),
    mockOrganizationsDelete: vi.fn(),
    mockEntriesList: vi.fn(),
    mockEntriesCreate: vi.fn(),
    mockEntriesGetById: vi.fn(),
    mockEntriesUpdate: vi.fn(),
    mockEntriesDelete: vi.fn(),
    mockTagsGetAll: vi.fn(),
    mockTagsRecord: vi.fn(),
    mockPositionsGetByOrg: vi.fn(),
    mockPositionsRecord: vi.fn(),
    mockVenuesGetByOrg: vi.fn(),
    mockVenuesRecord: vi.fn(),
    mockRulesetsListByOrg: vi.fn(),
    mockRulesetsListAll: vi.fn(),
    mockRulesetsCreate: vi.fn(),
    mockRulesetsDelete: vi.fn(),
    mockTransaction: vi.fn(),
}));

vi.mock("@/features/freelance-tracker/data", () => ({
    getDataLayer: () => ({
        organizations: {
            list: mocks.mockOrganizationsList,
            create: mocks.mockOrganizationsCreate,
            get: mocks.mockOrganizationsGet,
            update: mocks.mockOrganizationsUpdate,
            delete: mocks.mockOrganizationsDelete,
        },
        entries: {
            list: mocks.mockEntriesList,
            create: mocks.mockEntriesCreate,
            getById: mocks.mockEntriesGetById,
            update: mocks.mockEntriesUpdate,
            delete: mocks.mockEntriesDelete,
        },
        tags: {
            getAll: mocks.mockTagsGetAll,
            record: mocks.mockTagsRecord,
        },
        positions: {
            getByOrg: mocks.mockPositionsGetByOrg,
            record: mocks.mockPositionsRecord,
        },
        venues: {
            getByOrg: mocks.mockVenuesGetByOrg,
            record: mocks.mockVenuesRecord,
        },
        rulesets: {
            listByOrg: mocks.mockRulesetsListByOrg,
            listAll: mocks.mockRulesetsListAll,
            create: mocks.mockRulesetsCreate,
            delete: mocks.mockRulesetsDelete,
        },
        transaction: {
            transaction: mocks.mockTransaction,
        },
    }),
}));

import useFreelanceTrackerStore from "../store";

function resetStore() {
    useFreelanceTrackerStore.setState({
        entries: [],
        organizations: [],
        selectedPeriod: null,
        tagHistories: [],
        positionHistories: [],
        venueHistories: [],
        rulesets: [],
        sharedRulesets: [],
        loading: false,
        error: null,
        isFormOpen: false,
        editingEntryId: null,
    });
}

describe("freelance tracker zustand store", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetStore();
        mocks.mockTransaction.mockImplementation(async (fn) =>
            fn({
                entries: {
                    create: mocks.mockEntriesCreate,
                    update: mocks.mockEntriesUpdate,
                },
                organizations: {
                    get: mocks.mockOrganizationsGet,
                    update: mocks.mockOrganizationsUpdate,
                },
                tags: {
                    record: mocks.mockTagsRecord,
                },
                positions: {
                    record: mocks.mockPositionsRecord,
                },
                venues: {
                    record: mocks.mockVenuesRecord,
                },
            }),
        );
        mocks.mockOrganizationsGet.mockImplementation(
            async (organizationId) => ({
                success: true,
                data: {
                    organizationId,
                    name: "Org 1",
                    payPeriodStartDay: 1,
                    timezone: "UTC",
                    workweekStartDay: 1,
                    notes: null,
                    venues: [],
                    positions: [],
                    rulesetIds: [],
                    createdAt: new Date().toISOString(),
                },
            }),
        );
        mocks.mockOrganizationsUpdate.mockImplementation(
            async (organizationId, update) => ({
                success: true,
                data: {
                    organizationId,
                    name: "Org 1",
                    payPeriodStartDay: 1,
                    timezone: "UTC",
                    workweekStartDay: 1,
                    notes: update.notes ?? null,
                    venues: update.venues ?? [],
                    positions: update.positions ?? [],
                    rulesetIds: update.rulesetIds ?? [],
                    createdAt: new Date().toISOString(),
                },
            }),
        );
        mocks.mockOrganizationsDelete.mockResolvedValue({
            success: true,
            data: undefined,
        });
        mocks.mockEntriesGetById.mockImplementation(async (entryId) => ({
            success: true,
            data: {
                entryId,
                organizationId: testId("org"),
                dateWorked: "2026-04-14",
                startTime: "09:00",
                endTime: "10:00",
                venue: null,
                position: "Tech",
                rate: 30,
                event: null,
                tags: [],
                notes: null,
                mealPenaltyCount: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
        }));
        mocks.mockTagsRecord.mockImplementation(async (tag) => ({
            success: true,
            data: {
                tag,
                count: 1,
                lastUsedAt: new Date().toISOString(),
            },
        }));
        mocks.mockPositionsRecord.mockImplementation(
            async (organizationId, position) => ({
                success: true,
                data: {
                    organizationId,
                    position,
                    count: 1,
                    lastUsedAt: new Date().toISOString(),
                },
            }),
        );
        mocks.mockVenuesRecord.mockImplementation(
            async (organizationId, venueName) => ({
                success: true,
                data: {
                    organizationId,
                    venueName,
                    count: 1,
                    lastUsedAt: new Date().toISOString(),
                },
            }),
        );
        mocks.mockRulesetsListByOrg.mockResolvedValue({
            success: true,
            data: [],
        });
        mocks.mockRulesetsListAll.mockResolvedValue({
            success: true,
            data: [],
        });
        mocks.mockRulesetsCreate.mockResolvedValue({
            success: true,
            data: {
                rulesetId: testId("ruleset"),
                effectiveDate: "2026-04-01",
                rules: [],
                createdAt: new Date().toISOString(),
            },
        });
        mocks.mockRulesetsDelete.mockResolvedValue({
            success: true,
            data: undefined,
        });
    });

    it("starts with expected default state", () => {
        const state = useFreelanceTrackerStore.getState();
        expect(state.entries).toEqual([]);
        expect(state.organizations).toEqual([]);
        expect(state.loading).toBe(false);
        expect(state.error).toBeNull();
    });

    it("loadOrganizations populates state", async () => {
        const org = {
            organizationId: testId("org"),
            name: "Org 1",
            payPeriodStartDay: 1,
            timezone: "UTC",
            workweekStartDay: 1,
            notes: null,
            venues: [],
            positions: [],
            rulesetIds: [],
            createdAt: new Date().toISOString(),
        };
        mocks.mockOrganizationsList.mockResolvedValue({
            success: true,
            data: [org],
        });

        await useFreelanceTrackerStore.getState().loadOrganizations();

        const state = useFreelanceTrackerStore.getState();
        expect(state.organizations).toEqual([org]);
        expect(state.error).toBeNull();
    });

    it("loadEntries stores fetched entries for selected period", async () => {
        const orgId = testId("org");
        const entries = [{ entryId: testId("entry"), organizationId: orgId }];
        mocks.mockEntriesList.mockResolvedValue({
            success: true,
            data: entries,
        });

        await useFreelanceTrackerStore.getState().loadEntries(orgId, {
            startDate: "2026-04-13",
            endDate: "2026-04-19",
        });

        expect(useFreelanceTrackerStore.getState().entries).toEqual(entries);
    });

    it("create/update/delete entry changes state and clears editing when needed", async () => {
        const orgId = testId("org");
        const created = {
            entryId: testId("entry"),
            organizationId: orgId,
            dateWorked: "2026-04-14",
            startTime: "09:00",
            endTime: "10:00",
            venue: null,
            position: "Tech",
            rate: 30,
            event: null,
            tags: [],
            notes: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        mocks.mockEntriesCreate.mockResolvedValue({
            success: true,
            data: created,
        });
        mocks.mockEntriesUpdate.mockResolvedValue({
            success: true,
            data: { ...created, position: "Lead" },
        });
        mocks.mockEntriesDelete.mockResolvedValue({
            success: true,
            data: undefined,
        });

        await useFreelanceTrackerStore.getState().createEntry({
            organizationId: orgId,
            dateWorked: "2026-04-14",
            startTime: "09:00",
            endTime: "10:00",
            venue: null,
            position: "Tech",
            rate: 30,
            event: null,
            tags: [],
            notes: null,
            mealPenaltyCount: 0,
        });
        expect(useFreelanceTrackerStore.getState().entries).toHaveLength(1);

        useFreelanceTrackerStore.getState().setEditingEntry(created.entryId);
        await useFreelanceTrackerStore
            .getState()
            .updateEntry(created.entryId, { position: "Lead" });
        expect(useFreelanceTrackerStore.getState().entries[0].position).toBe(
            "Lead",
        );
        expect(useFreelanceTrackerStore.getState().editingEntryId).toBeNull();

        await useFreelanceTrackerStore.getState().deleteEntry(created.entryId);
        expect(useFreelanceTrackerStore.getState().entries).toHaveLength(0);
    });

    it("selectPeriod sets date range", () => {
        useFreelanceTrackerStore
            .getState()
            .selectPeriod("2026-04-13", "2026-04-19");

        const state = useFreelanceTrackerStore.getState();
        expect(state.selectedPeriod).toEqual({
            startDate: "2026-04-13",
            endDate: "2026-04-19",
        });
    });

    it("stores error messages from DAL failures", async () => {
        mocks.mockOrganizationsList.mockResolvedValue({
            success: false,
            error: { message: "boom" },
        });

        await useFreelanceTrackerStore.getState().loadOrganizations();
        expect(useFreelanceTrackerStore.getState().error).toBe("boom");

        useFreelanceTrackerStore.getState().setError(null);
        expect(useFreelanceTrackerStore.getState().error).toBeNull();
    });

    it("createOrganization reuses matching organization already in state", async () => {
        const existingOrg = {
            organizationId: testId("org-existing"),
            name: "Org A",
            payPeriodStartDay: 1,
            timezone: "UTC",
            workweekStartDay: 1,
            notes: null,
            venues: [],
            positions: [],
            rulesetIds: [],
            createdAt: new Date().toISOString(),
        };

        useFreelanceTrackerStore.setState({
            organizations: [existingOrg],
        });

        const result = await useFreelanceTrackerStore
            .getState()
            .createOrganization({
                name: "  org   a  ",
                payPeriodStartDay: 4,
            });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.organizationId).toBe(existingOrg.organizationId);
        }
        expect(mocks.mockOrganizationsList).not.toHaveBeenCalled();
        expect(mocks.mockOrganizationsCreate).not.toHaveBeenCalled();
    });

    it("createOrganization reuses matching organization returned by DAL list", async () => {
        const existingOrg = {
            organizationId: testId("org-list"),
            name: "Org B",
            payPeriodStartDay: 2,
            timezone: "UTC",
            workweekStartDay: 1,
            notes: null,
            venues: [],
            positions: [],
            rulesetIds: [],
            createdAt: new Date().toISOString(),
        };

        mocks.mockOrganizationsList.mockResolvedValue({
            success: true,
            data: [existingOrg],
        });

        const result = await useFreelanceTrackerStore
            .getState()
            .createOrganization({
                name: "org b",
                payPeriodStartDay: 2,
            });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.organizationId).toBe(existingOrg.organizationId);
        }
        expect(mocks.mockOrganizationsCreate).not.toHaveBeenCalled();
    });

    it("createOrganization returns validation error for blank name", async () => {
        const result = await useFreelanceTrackerStore
            .getState()
            .createOrganization({
                name: "    ",
                payPeriodStartDay: 1,
            });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(
                "message" in result.error ? result.error.message : "",
            ).toMatch(/organization name is required/i);
        }
        expect(mocks.mockOrganizationsList).not.toHaveBeenCalled();
        expect(mocks.mockOrganizationsCreate).not.toHaveBeenCalled();
        expect(useFreelanceTrackerStore.getState().error).toBe(
            "Organization name is required",
        );
    });

    it("createOrganization forwards markdown notes to the DAL create contract", async () => {
        const createdOrg = {
            organizationId: testId("org-created"),
            name: "Org Notes",
            payPeriodStartDay: 1,
            timezone: "UTC",
            workweekStartDay: 1,
            notes: "## Load-in\n\nBring badges.",
            venues: [],
            positions: [],
            rulesetIds: [],
            createdAt: new Date().toISOString(),
        };

        mocks.mockOrganizationsList.mockResolvedValue({
            success: true,
            data: [],
        });
        mocks.mockOrganizationsCreate.mockResolvedValue({
            success: true,
            data: createdOrg,
        });

        const result = await useFreelanceTrackerStore
            .getState()
            .createOrganization({
                name: "Org Notes",
                payPeriodStartDay: 1,
                notes: "## Load-in\n\nBring badges.",
            });

        expect(result.success).toBe(true);
        expect(mocks.mockOrganizationsCreate).toHaveBeenCalledWith({
            name: "Org Notes",
            payPeriodStartDay: 1,
            timezone: "UTC",
            workweekStartDay: 1,
            notes: "## Load-in\n\nBring badges.",
            venues: [],
            positions: [],
            rulesetIds: [],
        });
    });

    it("createOrganization forwards selected shared ruleset IDs to the DAL", async () => {
        const createdOrg = {
            organizationId: testId("org-shared"),
            name: "Shared Org",
            payPeriodStartDay: 1,
            timezone: "UTC",
            workweekStartDay: 1,
            notes: null,
            venues: [],
            positions: [],
            rulesetIds: ["ruleset-1", "ruleset-2"],
            createdAt: new Date().toISOString(),
        };

        mocks.mockOrganizationsList.mockResolvedValue({
            success: true,
            data: [],
        });
        mocks.mockOrganizationsCreate.mockResolvedValue({
            success: true,
            data: createdOrg,
        });

        const result = await useFreelanceTrackerStore
            .getState()
            .createOrganization({
                name: "Shared Org",
                payPeriodStartDay: 1,
                rulesetIds: ["ruleset-1" as any, "ruleset-2" as any],
            });

        expect(result.success).toBe(true);
        expect(mocks.mockOrganizationsCreate).toHaveBeenCalledWith({
            name: "Shared Org",
            payPeriodStartDay: 1,
            timezone: "UTC",
            workweekStartDay: 1,
            notes: null,
            venues: [],
            positions: [],
            rulesetIds: ["ruleset-1", "ruleset-2"],
        });
    });

    it("loadRulesets decorates shared rulesets with the requested organization for UI state", async () => {
        const organizationId = testId("org-ruleset");
        mocks.mockRulesetsListByOrg.mockResolvedValue({
            success: true,
            data: [
                {
                    rulesetId: testId("ruleset"),
                    effectiveDate: "2026-04-01",
                    rules: [],
                    createdAt: new Date().toISOString(),
                },
            ],
        });

        await useFreelanceTrackerStore.getState().loadRulesets(organizationId);

        expect(useFreelanceTrackerStore.getState().rulesets).toEqual([
            expect.objectContaining({
                organizationId,
            }),
        ]);
    });

    it("loadSharedRulesets loads global ruleset catalog for assignment flows", async () => {
        const globalRuleset = {
            rulesetId: testId("ruleset-global"),
            effectiveDate: "2026-05-01",
            rules: [],
            createdAt: new Date().toISOString(),
        };

        mocks.mockRulesetsListAll.mockResolvedValue({
            success: true,
            data: [globalRuleset],
        });

        await useFreelanceTrackerStore.getState().loadSharedRulesets();

        expect(mocks.mockRulesetsListAll).toHaveBeenCalledTimes(1);
        expect(useFreelanceTrackerStore.getState().sharedRulesets).toEqual([
            globalRuleset,
        ]);
    });

    it("getSharedRulesetAssignmentSummary includes assigned and unassigned rulesets by default", () => {
        const assignedRulesetId = testId("ruleset-assigned");
        const unassignedRulesetId = testId("ruleset-unassigned");
        const orgAId = testId("org-a");
        const orgBId = testId("org-b");

        useFreelanceTrackerStore.setState({
            organizations: [
                {
                    organizationId: orgAId,
                    name: "Org A",
                    payPeriodStartDay: 1,
                    timezone: "UTC",
                    workweekStartDay: 1,
                    notes: null,
                    venues: [],
                    positions: [],
                    rulesetIds: [assignedRulesetId],
                    createdAt: new Date().toISOString(),
                },
                {
                    organizationId: orgBId,
                    name: "Org B",
                    payPeriodStartDay: 1,
                    timezone: "UTC",
                    workweekStartDay: 1,
                    notes: null,
                    venues: [],
                    positions: [],
                    rulesetIds: [assignedRulesetId],
                    createdAt: new Date().toISOString(),
                },
            ],
            sharedRulesets: [
                {
                    rulesetId: assignedRulesetId,
                    effectiveDate: "2026-05-01",
                    rules: [],
                    createdAt: new Date().toISOString(),
                },
                {
                    rulesetId: unassignedRulesetId,
                    effectiveDate: "2026-04-01",
                    rules: [],
                    createdAt: new Date().toISOString(),
                },
            ],
        });

        const summary = useFreelanceTrackerStore
            .getState()
            .getSharedRulesetAssignmentSummary();

        expect(summary).toHaveLength(2);
        expect(summary).toEqual([
            expect.objectContaining({
                ruleset: expect.objectContaining({
                    rulesetId: assignedRulesetId,
                }),
                assignedOrganizationCount: 2,
                isAssigned: true,
                assignedOrganizationIds: [orgAId, orgBId],
            }),
            expect.objectContaining({
                ruleset: expect.objectContaining({
                    rulesetId: unassignedRulesetId,
                }),
                assignedOrganizationCount: 0,
                isAssigned: false,
                assignedOrganizationIds: [],
            }),
        ]);
    });

    it("getSharedRulesetAssignmentSummary supports assigned/unassigned filtering", () => {
        const assignedRulesetId = testId("ruleset-assigned");
        const unassignedRulesetId = testId("ruleset-unassigned");
        const organizationId = testId("org-filter");

        useFreelanceTrackerStore.setState({
            organizations: [
                {
                    organizationId,
                    name: "Org Filter",
                    payPeriodStartDay: 1,
                    timezone: "UTC",
                    workweekStartDay: 1,
                    notes: null,
                    venues: [],
                    positions: [],
                    rulesetIds: [assignedRulesetId],
                    createdAt: new Date().toISOString(),
                },
            ],
            sharedRulesets: [
                {
                    rulesetId: assignedRulesetId,
                    effectiveDate: "2026-05-01",
                    rules: [],
                    createdAt: new Date().toISOString(),
                },
                {
                    rulesetId: unassignedRulesetId,
                    effectiveDate: "2026-04-01",
                    rules: [],
                    createdAt: new Date().toISOString(),
                },
            ],
        });

        const assignedOnly = useFreelanceTrackerStore
            .getState()
            .getSharedRulesetAssignmentSummary({
                includeAssigned: true,
                includeUnassigned: false,
            });
        const unassignedOnly = useFreelanceTrackerStore
            .getState()
            .getSharedRulesetAssignmentSummary({
                includeAssigned: false,
                includeUnassigned: true,
            });

        expect(assignedOnly).toHaveLength(1);
        expect(assignedOnly[0].ruleset.rulesetId).toBe(assignedRulesetId);
        expect(unassignedOnly).toHaveLength(1);
        expect(unassignedOnly[0].ruleset.rulesetId).toBe(unassignedRulesetId);
    });

    it("getSharedRulesetAssignment returns a single ruleset assignment summary and null for unknown rulesets", () => {
        const assignedRulesetId = testId("ruleset-single");
        const organizationId = testId("org-single");

        useFreelanceTrackerStore.setState({
            organizations: [
                {
                    organizationId,
                    name: "Org Single",
                    payPeriodStartDay: 1,
                    timezone: "UTC",
                    workweekStartDay: 1,
                    notes: null,
                    venues: [],
                    positions: [],
                    rulesetIds: [assignedRulesetId],
                    createdAt: new Date().toISOString(),
                },
            ],
            sharedRulesets: [
                {
                    rulesetId: assignedRulesetId,
                    effectiveDate: "2026-05-01",
                    rules: [],
                    createdAt: new Date().toISOString(),
                },
            ],
        });

        const assignment = useFreelanceTrackerStore
            .getState()
            .getSharedRulesetAssignment(assignedRulesetId);
        const missing = useFreelanceTrackerStore
            .getState()
            .getSharedRulesetAssignment(testId("ruleset-missing"));

        expect(assignment).toEqual(
            expect.objectContaining({
                ruleset: expect.objectContaining({
                    rulesetId: assignedRulesetId,
                }),
                assignedOrganizationIds: [organizationId],
                assignedOrganizationCount: 1,
                isAssigned: true,
            }),
        );
        expect(missing).toBeNull();
    });

    it("deleteOrganization removes only the organization and local associations without deleting shared rulesets", async () => {
        const organizationId = testId("org-delete");
        const sharedRulesetId = testId("ruleset-shared");

        useFreelanceTrackerStore.setState({
            organizations: [
                {
                    organizationId,
                    name: "Org Delete",
                    payPeriodStartDay: 1,
                    timezone: "UTC",
                    workweekStartDay: 1,
                    notes: null,
                    venues: [],
                    positions: [],
                    rulesetIds: [sharedRulesetId],
                    createdAt: new Date().toISOString(),
                },
            ],
            rulesets: [
                {
                    rulesetId: sharedRulesetId,
                    organizationId,
                    effectiveDate: "2026-04-01",
                    rules: [],
                    createdAt: new Date().toISOString(),
                },
            ],
            sharedRulesets: [
                {
                    rulesetId: sharedRulesetId,
                    effectiveDate: "2026-04-01",
                    rules: [],
                    createdAt: new Date().toISOString(),
                },
            ],
            entries: [
                {
                    entryId: testId("entry"),
                    organizationId,
                    dateWorked: "2026-04-14",
                    startTime: "09:00",
                    endTime: "10:00",
                    venue: null,
                    position: "Tech",
                    rate: 30,
                    event: null,
                    tags: [],
                    notes: null,
                    mealPenaltyCount: 0,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                },
            ],
            positionHistories: [
                {
                    organizationId,
                    position: "Tech",
                    count: 1,
                    lastUsedAt: new Date().toISOString(),
                },
            ],
            venueHistories: [
                {
                    organizationId,
                    venueName: "Main",
                    count: 1,
                    lastUsedAt: new Date().toISOString(),
                },
            ],
        });

        const result = await useFreelanceTrackerStore
            .getState()
            .deleteOrganization(organizationId);

        expect(result.success).toBe(true);
        expect(mocks.mockOrganizationsDelete).toHaveBeenCalledWith(
            organizationId,
        );
        expect(mocks.mockRulesetsDelete).not.toHaveBeenCalled();
        expect(useFreelanceTrackerStore.getState().organizations).toEqual([]);
        expect(useFreelanceTrackerStore.getState().rulesets).toEqual([]);
        expect(useFreelanceTrackerStore.getState().sharedRulesets).toEqual([
            expect.objectContaining({
                rulesetId: sharedRulesetId,
            }),
        ]);
        expect(useFreelanceTrackerStore.getState().entries).toEqual([]);
        expect(useFreelanceTrackerStore.getState().positionHistories).toEqual(
            [],
        );
        expect(useFreelanceTrackerStore.getState().venueHistories).toEqual([]);
    });

    it("deleteRuleset safely deletes an unassigned shared ruleset without mutating organization assignments", async () => {
        const assignedRulesetId = testId("ruleset-assigned-existing");
        const unassignedRulesetId = testId("ruleset-unassigned-delete");
        const organizationId = testId("org-safe-delete");

        useFreelanceTrackerStore.setState({
            organizations: [
                {
                    organizationId,
                    name: "Org Safe Delete",
                    payPeriodStartDay: 1,
                    timezone: "UTC",
                    workweekStartDay: 1,
                    notes: null,
                    venues: [],
                    positions: [],
                    rulesetIds: [assignedRulesetId],
                    createdAt: new Date().toISOString(),
                },
            ],
            sharedRulesets: [
                {
                    rulesetId: assignedRulesetId,
                    effectiveDate: "2026-05-01",
                    rules: [],
                    createdAt: new Date().toISOString(),
                },
                {
                    rulesetId: unassignedRulesetId,
                    effectiveDate: "2026-04-01",
                    rules: [],
                    createdAt: new Date().toISOString(),
                },
            ],
        });

        const result = await useFreelanceTrackerStore
            .getState()
            .deleteRuleset(unassignedRulesetId);

        expect(result.success).toBe(true);
        expect(mocks.mockRulesetsDelete).toHaveBeenCalledWith(
            unassignedRulesetId,
        );
        expect(
            useFreelanceTrackerStore.getState().organizations[0].rulesetIds,
        ).toEqual([assignedRulesetId]);
        expect(
            useFreelanceTrackerStore
                .getState()
                .sharedRulesets.map((ruleset) => ruleset.rulesetId),
        ).toEqual([assignedRulesetId]);
    });

    it("deleteRuleset preserves assigned behavior by removing organization associations", async () => {
        const assignedRulesetId = testId("ruleset-delete-assigned");
        const organizationId = testId("org-delete-assigned");

        useFreelanceTrackerStore.setState({
            organizations: [
                {
                    organizationId,
                    name: "Org Delete Assigned",
                    payPeriodStartDay: 1,
                    timezone: "UTC",
                    workweekStartDay: 1,
                    notes: null,
                    venues: [],
                    positions: [],
                    rulesetIds: [assignedRulesetId],
                    createdAt: new Date().toISOString(),
                },
            ],
            rulesets: [
                {
                    rulesetId: assignedRulesetId,
                    organizationId,
                    effectiveDate: "2026-05-01",
                    rules: [],
                    createdAt: new Date().toISOString(),
                },
            ],
            sharedRulesets: [
                {
                    rulesetId: assignedRulesetId,
                    effectiveDate: "2026-05-01",
                    rules: [],
                    createdAt: new Date().toISOString(),
                },
            ],
        });

        const result = await useFreelanceTrackerStore
            .getState()
            .deleteRuleset(assignedRulesetId);

        expect(result.success).toBe(true);
        expect(mocks.mockRulesetsDelete).toHaveBeenCalledWith(
            assignedRulesetId,
        );
        expect(useFreelanceTrackerStore.getState().rulesets).toEqual([]);
        expect(useFreelanceTrackerStore.getState().sharedRulesets).toEqual([]);
        expect(
            useFreelanceTrackerStore.getState().organizations[0].rulesetIds,
        ).toEqual([]);
    });
});
