import { beforeEach, describe, expect, it, vi } from "vitest";
import { testId } from "../../test-utils/fixtures";

const mocks = vi.hoisted(() => ({
    mockOrganizationsList: vi.fn(),
    mockOrganizationsCreate: vi.fn(),
    mockOrganizationsGet: vi.fn(),
    mockOrganizationsUpdate: vi.fn(),
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
    mockTransaction: vi.fn(),
}));

vi.mock("@/features/freelance-tracker/data", () => ({
    getDataLayer: () => ({
        organizations: {
            list: mocks.mockOrganizationsList,
            create: mocks.mockOrganizationsCreate,
            get: mocks.mockOrganizationsGet,
            update: mocks.mockOrganizationsUpdate,
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
                    createdAt: new Date().toISOString(),
                },
            }),
        );
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
        });
    });
});
