/**
 * Tests for Zustand store
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import useFreelanceTrackerStore from "./store";
import { createId } from "@/features/freelance-tracker/contracts/types";

// Mock DAL
vi.mock("@/features/freelance-tracker/data", () => ({
    getDataLayer: () => ({
        organizations: {
            list: vi.fn(async () => ({
                success: true,
                data: [
                    {
                        organizationId: createId(),
                        name: "Test Org",
                        payPeriodStartDay: 1,
                        timezone: "UTC",
                        workweekStartDay: 1,
                        venues: [],
                        positions: [],
                        createdAt: new Date().toISOString(),
                    },
                ],
            })),
            get: vi.fn(async (id) => ({
                success: true,
                data: {
                    organizationId: id,
                    name: "Test Org",
                    payPeriodStartDay: 1,
                    timezone: "UTC",
                    workweekStartDay: 1,
                    venues: [],
                    positions: [],
                    createdAt: new Date().toISOString(),
                },
            })),
            update: vi.fn(async (id, update) => ({
                success: true,
                data: {
                    organizationId: id,
                    name: "Test Org",
                    payPeriodStartDay: 1,
                    timezone: "UTC",
                    workweekStartDay: 1,
                    venues: update.venues ?? [],
                    positions: update.positions ?? [],
                    createdAt: new Date().toISOString(),
                },
            })),
        },
        entries: {
            list: vi.fn(async () => ({
                success: true,
                data: [],
            })),
            getById: vi.fn(async (id) => ({
                success: true,
                data: {
                    entryId: id,
                    organizationId: createId(),
                    dateWorked: "2026-04-14",
                    startTime: "09:00",
                    endTime: "17:00",
                    venue: null,
                    position: "Tech",
                    rate: 150,
                    event: null,
                    tags: [],
                    notes: null,
                    mealPenaltyCount: 0,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                },
            })),
            create: vi.fn(async (entry) => ({
                success: true,
                data: {
                    ...entry,
                    entryId: createId(),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                },
            })),
            update: vi.fn(async (id, updates) => ({
                success: true,
                data: {
                    ...updates,
                    entryId: id,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                },
            })),
            delete: vi.fn(async () => ({
                success: true,
                data: undefined,
            })),
        },
        tags: {
            getAll: vi.fn(async () => ({
                success: true,
                data: [],
            })),
            record: vi.fn(async (tag) => ({
                success: true,
                data: {
                    tag,
                    count: 1,
                    lastUsedAt: new Date().toISOString(),
                },
            })),
        },
        positions: {
            getByOrg: vi.fn(async () => ({
                success: true,
                data: [],
            })),
            record: vi.fn(async (organizationId, position) => ({
                success: true,
                data: {
                    organizationId,
                    position,
                    count: 1,
                    lastUsedAt: new Date().toISOString(),
                },
            })),
        },
        venues: {
            getByOrg: vi.fn(async () => ({
                success: true,
                data: [],
            })),
            record: vi.fn(async (organizationId, venueName) => ({
                success: true,
                data: {
                    organizationId,
                    venueName,
                    count: 1,
                    lastUsedAt: new Date().toISOString(),
                },
            })),
        },
        rulesets: {
            listByOrg: vi.fn(async () => ({ success: true, data: [] })),
            create: vi.fn(async () => ({
                success: false,
                error: { type: "io", message: "Not implemented" },
            })),
        },
        transaction: {
            transaction: vi.fn(async (fn) =>
                fn({
                    entries: {
                        create: async (entry: any) => ({
                            success: true,
                            data: {
                                ...entry,
                                entryId: createId(),
                                createdAt: new Date().toISOString(),
                                updatedAt: new Date().toISOString(),
                            },
                        }),
                        update: async (id: any, updates: any) => ({
                            success: true,
                            data: {
                                tags: [],
                                notes: null,
                                event: null,
                                mealPenaltyCount: 0,
                                venue: null,
                                startTime: "09:00",
                                endTime: "17:00",
                                dateWorked: "2026-04-14",
                                ...updates,
                                organizationId:
                                    updates.organizationId ?? createId(),
                                entryId: id,
                                createdAt: new Date().toISOString(),
                                updatedAt: new Date().toISOString(),
                            },
                        }),
                    },
                    organizations: {
                        get: async (id: any) => ({
                            success: true,
                            data: {
                                organizationId: id,
                                name: "Test Org",
                                payPeriodStartDay: 1,
                                timezone: "UTC",
                                workweekStartDay: 1,
                                venues: [],
                                positions: [],
                                createdAt: new Date().toISOString(),
                            },
                        }),
                        update: async (id: any, update: any) => ({
                            success: true,
                            data: {
                                organizationId: id,
                                name: "Test Org",
                                payPeriodStartDay: 1,
                                timezone: "UTC",
                                workweekStartDay: 1,
                                venues: update.venues ?? [],
                                positions: update.positions ?? [],
                                createdAt: new Date().toISOString(),
                            },
                        }),
                    },
                    tags: {
                        record: async (tag: any) => ({
                            success: true,
                            data: {
                                tag,
                                count: 1,
                                lastUsedAt: new Date().toISOString(),
                            },
                        }),
                    },
                    positions: {
                        record: async (organizationId: any, position: any) => ({
                            success: true,
                            data: {
                                organizationId,
                                position,
                                count: 1,
                                lastUsedAt: new Date().toISOString(),
                            },
                        }),
                    },
                    venues: {
                        record: async (
                            organizationId: any,
                            venueName: any,
                        ) => ({
                            success: true,
                            data: {
                                organizationId,
                                venueName,
                                count: 1,
                                lastUsedAt: new Date().toISOString(),
                            },
                        }),
                    },
                }),
            ),
        },
    }),
}));

describe("FreelanceTrackerStore", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useFreelanceTrackerStore.setState({
            entries: [],
            organizations: [],
            selectedPeriod: null,
            tagHistories: [],
            positionHistories: [],
            venueHistories: [],
            rulesets: [],
            loading: false,
            error: null,
            isFormOpen: false,
            editingEntryId: null,
        });
    });

    it("initializes with empty state", () => {
        const { result } = renderHook(() => useFreelanceTrackerStore());

        expect(result.current.entries).toEqual([]);
        expect(result.current.organizations).toEqual([]);
        expect(result.current.selectedPeriod).toBeNull();
        expect(result.current.loading).toBe(false);
    });

    it("loads organizations", async () => {
        const { result } = renderHook(() => useFreelanceTrackerStore());

        await act(async () => {
            await result.current.loadOrganizations();
        });

        expect(result.current.organizations.length).toBeGreaterThan(0);
        expect(result.current.organizations[0].name).toBe("Test Org");
    });

    it("loads organizations without setting a global organization context", async () => {
        const { result } = renderHook(() => useFreelanceTrackerStore());

        await act(async () => {
            await result.current.loadOrganizations();
        });

        expect(result.current.organizations.length).toBeGreaterThan(0);
    });

    it("creates entry", async () => {
        const { result } = renderHook(() => useFreelanceTrackerStore());

        const orgId = createId();
        const entry = {
            organizationId: orgId,
            dateWorked: "2026-04-14",
            startTime: "09:00",
            endTime: "17:00",
            venue: null,
            position: "Tech",
            rate: 150,
            event: null,
            tags: [],
            notes: null,
            mealPenaltyCount: 0,
        };

        await act(async () => {
            await result.current.createEntry(entry);
        });

        expect(result.current.entries.length).toBe(1);
        expect(result.current.entries[0].position).toBe("Tech");
    });

    it("updates entry", async () => {
        const { result } = renderHook(() => useFreelanceTrackerStore());

        const orgId = createId();
        const entry = {
            organizationId: orgId,
            dateWorked: "2026-04-14",
            startTime: "09:00",
            endTime: "17:00",
            venue: null,
            position: "Tech",
            rate: 150,
            event: null,
            tags: [],
            notes: null,
            mealPenaltyCount: 0,
        };

        await act(async () => {
            await result.current.createEntry(entry);
        });

        const entryId = result.current.entries[0].entryId;

        await act(async () => {
            await result.current.updateEntry(entryId, { position: "Manager" });
        });

        expect(result.current.entries[0].position).toBe("Manager");
    });

    it("deletes entry", async () => {
        const { result } = renderHook(() => useFreelanceTrackerStore());

        const orgId = createId();
        const entry = {
            organizationId: orgId,
            dateWorked: "2026-04-14",
            startTime: "09:00",
            endTime: "17:00",
            venue: null,
            position: "Tech",
            rate: 150,
            event: null,
            tags: [],
            notes: null,
            mealPenaltyCount: 0,
        };

        await act(async () => {
            await result.current.createEntry(entry);
        });

        const entryId = result.current.entries[0].entryId;

        await act(async () => {
            await result.current.deleteEntry(entryId);
        });

        expect(result.current.entries.length).toBe(0);
    });

    it("selects period", () => {
        const { result } = renderHook(() => useFreelanceTrackerStore());

        act(() => {
            result.current.selectPeriod("2026-04-13", "2026-04-19");
        });

        expect(result.current.selectedPeriod).toEqual({
            startDate: "2026-04-13",
            endDate: "2026-04-19",
        });
    });

    it("sets form open state", () => {
        const { result } = renderHook(() => useFreelanceTrackerStore());

        act(() => {
            result.current.setFormOpen(true);
        });

        expect(result.current.isFormOpen).toBe(true);

        act(() => {
            result.current.setFormOpen(false);
        });

        expect(result.current.isFormOpen).toBe(false);
    });

    it("sets editing entry", () => {
        const { result } = renderHook(() => useFreelanceTrackerStore());
        const entryId = createId();

        act(() => {
            result.current.setEditingEntry(entryId);
        });

        expect(result.current.editingEntryId).toBe(entryId);
        expect(result.current.isFormOpen).toBe(true);
    });

    it("sets error message", () => {
        const { result } = renderHook(() => useFreelanceTrackerStore());

        act(() => {
            result.current.setError("Test error");
        });

        expect(result.current.error).toBe("Test error");
    });

    it("creates an organization position by updating the organization catalog directly", async () => {
        const { result } = renderHook(() => useFreelanceTrackerStore());

        await act(async () => {
            await result.current.loadOrganizations();
        });

        const organizationId = result.current.organizations[0].organizationId;

        await act(async () => {
            const createResult =
                await result.current.createOrganizationPosition({
                    organizationId,
                    position: "Lighting Director",
                    defaultRate: 120,
                });

            expect(createResult.success).toBe(true);
        });

        expect(result.current.organizations[0].positions).toEqual([
            { name: "Lighting Director", defaultRate: 120 },
        ]);
    });

    it("keeps entries unchanged when selecting period", async () => {
        const { result } = renderHook(() => useFreelanceTrackerStore());

        // Create an entry first
        const orgId = createId();
        const entry = {
            organizationId: orgId,
            dateWorked: "2026-04-14",
            startTime: "09:00",
            endTime: "17:00",
            position: "Tech",
            rate: 150,
            event: null,
            tags: [],
            notes: null,
            mealPenaltyCount: 0,
        };

        await act(async () => {
            await result.current.createEntry(entry);
        });

        expect(result.current.entries.length).toBe(1);

        act(() => {
            result.current.selectPeriod("2026-04-01", "2026-04-30");
        });

        expect(result.current.entries.length).toBe(1);
    });

    it("handles loading state", async () => {
        const { result } = renderHook(() => useFreelanceTrackerStore());

        act(() => {
            expect(result.current.loading).toBe(false);
        });

        await act(async () => {
            await result.current.loadOrganizations();
        });

        // Should be false after loading completes
        expect(result.current.loading).toBe(false);
    });
});
