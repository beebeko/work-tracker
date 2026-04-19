/**
 * Unit tests for GrossPayCalculator
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { GrossPayCalculator } from "./GrossPayCalculator";
import type {
    Entry,
    Organization,
    Id,
    Result,
} from "@/features/freelance-tracker/contracts/types";
import { ok, err } from "@/features/freelance-tracker/contracts/types";
import type { IDataLayer } from "@/features/freelance-tracker/data/dal";

class MockDataLayer implements IDataLayer {
    organizations = {
        async list(): Promise<Result<Organization[]>> {
            return ok([]);
        },
        async get(organizationId: Id) {
            return ok({
                organizationId,
                name: "Test Organization",
                payPeriodStartDay: 1,
                timezone: "UTC",
                workweekStartDay: 1,
                createdAt: new Date().toISOString(),
            });
        },
        async create() {
            return err({ type: "io", message: "Not implemented" });
        },
        async update() {
            return err({ type: "io", message: "Not implemented" });
        },
        async delete() {
            return err({ type: "io", message: "Not implemented" });
        },
    };
    rulesets = {
        async create() {
            return err({ type: "io", message: "Not implemented" });
        },
        async getById() {
            return err({ type: "io", message: "Not implemented" });
        },
        async getActive() {
            return ok(null);
        },
        async listByOrg() {
            return ok([]);
        },
        async delete() {
            return ok(undefined);
        },
    };
    entries = {
        async list(_params: {
            organizationId: Id;
            startDate: string;
            endDate: string;
        }): Promise<Result<Entry[]>> {
            return ok([]);
        },
        async create() {
            return err({ type: "io", message: "Not implemented" });
        },
        async getById() {
            return err({ type: "io", message: "Not implemented" });
        },
        async update() {
            return err({ type: "io", message: "Not implemented" });
        },
        async delete() {
            return err({ type: "io", message: "Not implemented" });
        },
    };
    tags = {
        async getAll() {
            return ok([]);
        },
        async record() {
            return err({ type: "io", message: "Not implemented" });
        },
        async get() {
            return ok(null);
        },
    };
    positions = {
        async getByOrg() {
            return ok([]);
        },
        async record() {
            return err({ type: "io", message: "Not implemented" });
        },
        async get() {
            return ok(null);
        },
    };
    venues = {
        async getByOrg() {
            return ok([]);
        },
        async record() {
            return err({ type: "io", message: "Not implemented" });
        },
        async get() {
            return ok(null);
        },
    };
    transaction = {
        async transaction() {
            return err({ type: "io", message: "Not implemented" });
        },
    };
    async initialize() {
        return ok(undefined);
    }
    async dispose() {}
}

function createMockEntry(overrides: Partial<Entry> = {}): Entry {
    const { mealPenaltyCount, ...entryOverrides } = overrides;

    return {
        entryId: "entry-1" as Id,
        organizationId: "org-1" as Id,
        dateWorked: "2026-04-16",
        startTime: "09:00",
        endTime: "17:00",
        position: "Developer",
        rate: 50,
        event: null,
        tags: [],
        notes: null,
        mealPenaltyCount: mealPenaltyCount ?? 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...entryOverrides,
    };
}

describe("GrossPayCalculator", () => {
    let calculator: GrossPayCalculator;
    let mockDal: MockDataLayer;

    beforeEach(() => {
        mockDal = new MockDataLayer();
        calculator = new GrossPayCalculator({ dal: mockDal });
    });

    describe("single entry calculations", () => {
        it("should calculate pay for a single entry with 8 hours at $50/hour", async () => {
            const entry = createMockEntry({
                entryId: "entry-1" as Id,
                startTime: "09:00",
                endTime: "17:00",
                rate: 50,
            });

            mockDal.entries.list = vi.fn(async () => ok([entry]));
            mockDal.organizations.list = vi.fn(async () => ok([]));

            const result = await calculator.calculateGrossPayForPeriod(
                "org-1" as Id,
                {
                    startDate: "2026-04-16",
                    endDate: "2026-04-19",
                },
            );

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.totalPay).toBe(400); // 8 * 50
                expect(result.data.totalHours).toBe(8);
                expect(result.data.entriesWithoutRate).toBe(0);
                expect(result.data.breakdown).toHaveLength(1);
                expect(result.data.breakdown[0]).toEqual({
                    entryId: "entry-1",
                    hours: 8,
                    rate: 50,
                    pay: 400,
                });
            }
        });

        it("should handle partial hours correctly (e.g., 2.5 hours)", async () => {
            const entry = createMockEntry({
                startTime: "14:00",
                endTime: "16:30",
                rate: 20,
            });

            mockDal.entries.list = vi.fn(async () => ok([entry]));
            mockDal.organizations.list = vi.fn(async () => ok([]));

            const result = await calculator.calculateGrossPayForPeriod(
                "org-1" as Id,
                {
                    startDate: "2026-04-16",
                    endDate: "2026-04-19",
                },
            );

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.totalPay).toBe(50); // 2.5 * 20
                expect(result.data.totalHours).toBe(2.5);
            }
        });

        it("should handle entries with no rate (null)", async () => {
            const entry = createMockEntry({
                rate: null,
            });

            mockDal.entries.list = vi.fn(async () => ok([entry]));
            mockDal.organizations.list = vi.fn(async () => ok([]));

            const result = await calculator.calculateGrossPayForPeriod(
                "org-1" as Id,
                {
                    startDate: "2026-04-16",
                    endDate: "2026-04-19",
                },
            );

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.totalPay).toBe(0);
                expect(result.data.entriesWithoutRate).toBe(1);
                expect(result.data.breakdown[0].pay).toBeNull();
            }
        });

        it("should handle entry with 15 minutes (0.25 hours)", async () => {
            const entry = createMockEntry({
                startTime: "09:00",
                endTime: "09:15",
                rate: 40,
            });

            mockDal.entries.list = vi.fn(async () => ok([entry]));
            mockDal.organizations.list = vi.fn(async () => ok([]));

            const result = await calculator.calculateGrossPayForPeriod(
                "org-1" as Id,
                {
                    startDate: "2026-04-16",
                    endDate: "2026-04-19",
                },
            );

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.totalPay).toBe(10); // 0.25 * 40
                expect(result.data.totalHours).toBe(0.25);
            }
        });
    });

    describe("multiple entries with mixed rates", () => {
        it("should sum entries with rates and count entries without rates", async () => {
            const entries = [
                createMockEntry({
                    entryId: "entry-1" as Id,
                    startTime: "09:00",
                    endTime: "12:00",
                    rate: 50,
                }),
                createMockEntry({
                    entryId: "entry-2" as Id,
                    startTime: "13:00",
                    endTime: "17:00",
                    rate: null,
                }),
                createMockEntry({
                    entryId: "entry-3" as Id,
                    startTime: "18:00",
                    endTime: "20:00",
                    rate: 40,
                }),
            ];

            mockDal.entries.list = vi.fn(async () => ok(entries));
            mockDal.organizations.list = vi.fn(async () => ok([]));

            const result = await calculator.calculateGrossPayForPeriod(
                "org-1" as Id,
                {
                    startDate: "2026-04-16",
                    endDate: "2026-04-19",
                },
            );

            expect(result.success).toBe(true);
            if (result.success) {
                // 3 hours * 50 + 2 hours * 40 = 150 + 80 = 230
                expect(result.data.totalPay).toBe(230);
                expect(result.data.entriesWithoutRate).toBe(1); // Only entry-2
                expect(result.data.totalHours).toBe(9); // 3 + 4 + 2
                expect(result.data.breakdown).toHaveLength(3);
            }
        });

        it("should handle all entries without rates", async () => {
            const entries = [
                createMockEntry({
                    entryId: "entry-1" as Id,
                    rate: null,
                }),
                createMockEntry({
                    entryId: "entry-2" as Id,
                    rate: null,
                }),
            ];

            mockDal.entries.list = vi.fn(async () => ok(entries));
            mockDal.organizations.list = vi.fn(async () => ok([]));

            const result = await calculator.calculateGrossPayForPeriod(
                "org-1" as Id,
                {
                    startDate: "2026-04-16",
                    endDate: "2026-04-19",
                },
            );

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.totalPay).toBe(0);
                expect(result.data.entriesWithoutRate).toBe(2);
                expect(result.data.breakdown).toHaveLength(2);
                expect(
                    result.data.breakdown.every((item) => item.pay === null),
                ).toBe(true);
            }
        });

        it("should correctly accumulate breakdown for many entries", async () => {
            const entries = Array.from({ length: 10 }, (_, i) => {
                const rate = i % 2 === 0 ? 25 : null;
                return createMockEntry({
                    entryId: `entry-${i + 1}` as Id,
                    startTime: "09:00",
                    endTime: "10:00",
                    rate,
                });
            });

            mockDal.entries.list = vi.fn(async () => ok(entries));
            mockDal.organizations.list = vi.fn(async () => ok([]));

            const result = await calculator.calculateGrossPayForPeriod(
                "org-1" as Id,
                {
                    startDate: "2026-04-16",
                    endDate: "2026-04-19",
                },
            );

            expect(result.success).toBe(true);
            if (result.success) {
                // 5 entries with rate (25 each for 1 hour each) = 125
                expect(result.data.totalPay).toBe(125);
                expect(result.data.entriesWithoutRate).toBe(5);
                expect(result.data.breakdown).toHaveLength(10);
            }
        });
    });

    describe("cumulative calculation across organizations", () => {
        it("should sum total pay from all organizations", async () => {
            // Entries for org-1
            const org1Entries = [
                createMockEntry({
                    organizationId: "org-1" as Id,
                    entryId: "entry-1" as Id,
                    startTime: "09:00",
                    endTime: "12:00",
                    rate: 50,
                }),
            ];

            // Entries for org-2
            const org2Entries = [
                createMockEntry({
                    organizationId: "org-2" as Id,
                    entryId: "entry-2" as Id,
                    startTime: "14:00",
                    endTime: "18:00",
                    rate: 40,
                }),
            ];

            // When called on org-1, return org-1 entries
            mockDal.entries.list = vi.fn(async (params) => {
                if (params.organizationId === "org-1") {
                    return ok(org1Entries);
                }
                if (params.organizationId === "org-2") {
                    return ok(org2Entries);
                }
                return ok([]);
            });

            // When listing orgs, return both
            mockDal.organizations.list = vi.fn(async () =>
                ok([
                    {
                        organizationId: "org-1" as Id,
                        name: "Org 1",
                        payPeriodStartDay: 1,
                        timezone: "UTC",
                        workweekStartDay: 1,
                        createdAt: new Date().toISOString(),
                    },
                    {
                        organizationId: "org-2" as Id,
                        name: "Org 2",
                        payPeriodStartDay: 1,
                        timezone: "UTC",
                        workweekStartDay: 1,
                        createdAt: new Date().toISOString(),
                    },
                ]),
            );

            const result = await calculator.calculateGrossPayForPeriod(
                "org-1" as Id,
                {
                    startDate: "2026-04-16",
                    endDate: "2026-04-19",
                },
            );

            expect(result.success).toBe(true);
            if (result.success) {
                // Org-1: 3 hours * 50 = 150
                expect(result.data.totalPay).toBe(150);
                // Cumulative: 150 (org-1) + 160 (org-2, 4 hours * 40) = 310
                expect(result.data.cumulativePay).toBe(310);
            }
        });

        it("should exclude null rates from cumulative calculation", async () => {
            const org1Entries = [
                createMockEntry({
                    organizationId: "org-1" as Id,
                    entryId: "entry-1" as Id,
                    startTime: "09:00",
                    endTime: "12:00",
                    rate: 50,
                }),
            ];

            const org2Entries = [
                createMockEntry({
                    organizationId: "org-2" as Id,
                    entryId: "entry-2" as Id,
                    startTime: "14:00",
                    endTime: "18:00",
                    rate: null, // No rate
                }),
            ];

            mockDal.entries.list = vi.fn(async (params) => {
                if (params.organizationId === "org-1") {
                    return ok(org1Entries);
                }
                if (params.organizationId === "org-2") {
                    return ok(org2Entries);
                }
                return ok([]);
            });

            mockDal.organizations.list = vi.fn(async () =>
                ok([
                    {
                        organizationId: "org-1" as Id,
                        name: "Org 1",
                        payPeriodStartDay: 1,
                        timezone: "UTC",
                        workweekStartDay: 1,
                        createdAt: new Date().toISOString(),
                    },
                    {
                        organizationId: "org-2" as Id,
                        name: "Org 2",
                        payPeriodStartDay: 1,
                        timezone: "UTC",
                        workweekStartDay: 1,
                        createdAt: new Date().toISOString(),
                    },
                ]),
            );

            const result = await calculator.calculateGrossPayForPeriod(
                "org-1" as Id,
                {
                    startDate: "2026-04-16",
                    endDate: "2026-04-19",
                },
            );

            expect(result.success).toBe(true);
            if (result.success) {
                // Org-1: 3 hours * 50 = 150
                expect(result.data.totalPay).toBe(150);
                // Cumulative: 150 (org-1 only, org-2 has no rate) = 150
                expect(result.data.cumulativePay).toBe(150);
            }
        });

        it("should handle empty organization list for cumulative calc", async () => {
            const entries = [
                createMockEntry({
                    entryId: "entry-1" as Id,
                    startTime: "09:00",
                    endTime: "12:00",
                    rate: 50,
                }),
            ];

            mockDal.entries.list = vi.fn(async () => ok(entries));
            mockDal.organizations.list = vi.fn(async () => ok([])); // Empty org list

            const result = await calculator.calculateGrossPayForPeriod(
                "org-1" as Id,
                {
                    startDate: "2026-04-16",
                    endDate: "2026-04-19",
                },
            );

            expect(result.success).toBe(true);
            if (result.success) {
                // Org-1: 3 hours * 50 = 150
                expect(result.data.totalPay).toBe(150);
                // Cumulative: 0 (no organizations in list)
                expect(result.data.cumulativePay).toBe(0);
            }
        });
    });

    describe("error handling", () => {
        it("should return error if entries query fails", async () => {
            mockDal.entries.list = vi.fn(async () =>
                err({
                    type: "io",
                    message: "Database error",
                }),
            );

            const result = await calculator.calculateGrossPayForPeriod(
                "org-1" as Id,
                {
                    startDate: "2026-04-16",
                    endDate: "2026-04-19",
                },
            );

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.type).toBe("io");
            }
        });

        it("should return error if organizations list fails during cumulative calc", async () => {
            const entries = [
                createMockEntry({
                    rate: 50,
                }),
            ];

            mockDal.entries.list = vi.fn(async () => ok(entries));
            mockDal.organizations.list = vi.fn(async () =>
                err({
                    type: "io",
                    message: "Failed to list organizations",
                }),
            );

            const result = await calculator.calculateGrossPayForPeriod(
                "org-1" as Id,
                {
                    startDate: "2026-04-16",
                    endDate: "2026-04-19",
                },
            );

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.type).toBe("io");
            }
        });

        it("should return error if cumulative entries query fails", async () => {
            const entries = [
                createMockEntry({
                    rate: 50,
                }),
            ];

            mockDal.entries.list = vi.fn(async (params) => {
                if (params.organizationId === "org-1") {
                    return ok(entries);
                }
                // Simulate failure for cumulative query
                return err({
                    type: "io",
                    message: "Database error during cumulative",
                });
            });

            mockDal.organizations.list = vi.fn(async () =>
                ok([
                    {
                        organizationId: "org-1" as Id,
                        name: "Org 1",
                        payPeriodStartDay: 1,
                        timezone: "UTC",
                        workweekStartDay: 1,
                        createdAt: new Date().toISOString(),
                    },
                    {
                        organizationId: "org-2" as Id,
                        name: "Org 2",
                        payPeriodStartDay: 1,
                        timezone: "UTC",
                        workweekStartDay: 1,
                        createdAt: new Date().toISOString(),
                    },
                ]),
            );

            const result = await calculator.calculateGrossPayForPeriod(
                "org-1" as Id,
                {
                    startDate: "2026-04-16",
                    endDate: "2026-04-19",
                },
            );

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.type).toBe("io");
            }
        });
    });

    describe("empty entry list", () => {
        it("should handle no entries for period", async () => {
            mockDal.entries.list = vi.fn(async () => ok([]));
            mockDal.organizations.list = vi.fn(async () => ok([]));

            const result = await calculator.calculateGrossPayForPeriod(
                "org-1" as Id,
                {
                    startDate: "2026-04-16",
                    endDate: "2026-04-19",
                },
            );

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.totalPay).toBe(0);
                expect(result.data.entriesWithoutRate).toBe(0);
                expect(result.data.totalHours).toBe(0);
                expect(result.data.breakdown).toHaveLength(0);
                expect(result.data.cumulativePay).toBe(0);
            }
        });
    });

    describe("various rate and hour combinations", () => {
        it("should calculate fractional hours correctly", async () => {
            const entries = [
                createMockEntry({
                    entryId: "entry-1" as Id,
                    startTime: "09:00",
                    endTime: "09:30",
                    rate: 60,
                }),
                createMockEntry({
                    entryId: "entry-2" as Id,
                    startTime: "10:00",
                    endTime: "10:45",
                    rate: 40,
                }),
            ];

            mockDal.entries.list = vi.fn(async () => ok(entries));
            mockDal.organizations.list = vi.fn(async () => ok([]));

            const result = await calculator.calculateGrossPayForPeriod(
                "org-1" as Id,
                {
                    startDate: "2026-04-16",
                    endDate: "2026-04-19",
                },
            );

            expect(result.success).toBe(true);
            if (result.success) {
                // 0.5 hours * 60 + 0.75 hours * 40 = 30 + 30 = 60
                expect(result.data.totalPay).toBe(60);
                expect(result.data.totalHours).toBe(1.25);
            }
        });

        it("should handle different rates for different entries", async () => {
            const entries = [
                createMockEntry({
                    entryId: "entry-1" as Id,
                    startTime: "09:00",
                    endTime: "12:00",
                    rate: 25,
                }),
                createMockEntry({
                    entryId: "entry-2" as Id,
                    startTime: "13:00",
                    endTime: "17:00",
                    rate: 75,
                }),
                createMockEntry({
                    entryId: "entry-3" as Id,
                    startTime: "18:00",
                    endTime: "20:00",
                    rate: 35,
                }),
            ];

            mockDal.entries.list = vi.fn(async () => ok(entries));
            mockDal.organizations.list = vi.fn(async () => ok([]));

            const result = await calculator.calculateGrossPayForPeriod(
                "org-1" as Id,
                {
                    startDate: "2026-04-16",
                    endDate: "2026-04-19",
                },
            );

            expect(result.success).toBe(true);
            if (result.success) {
                // (3 * 25) + (4 * 75) + (2 * 35) = 75 + 300 + 70 = 445
                expect(result.data.totalPay).toBe(445);
                expect(result.data.totalHours).toBe(9);
            }
        });
    });
});
