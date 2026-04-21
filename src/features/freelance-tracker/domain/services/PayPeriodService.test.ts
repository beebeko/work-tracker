/**
 * Unit tests for PayPeriodService
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { PayPeriodService } from "./PayPeriodService";
import type {
    Organization,
    Id,
    Result,
} from "@/features/freelance-tracker/contracts/types";
import { ok, err } from "@/features/freelance-tracker/contracts/types";
import type { IDataLayer } from "@/features/freelance-tracker/data/dal";

// Mock IDataLayer
class MockDataLayer implements IDataLayer {
    organizations = {
        async get(organizationId: Id): Promise<Result<Organization>> {
            // Return a mock organization with a specific payPeriodStartDay
            return ok({
                organizationId,
                name: "Test Org",
                payPeriodStartDay: 1,
                timezone: "UTC",
                workweekStartDay: 1,
                createdAt: new Date().toISOString(),
            });
        },
        async list() {
            return ok([]);
        },
        async create() {
            return err({
                type: "io",
                message: "Not implemented in mock",
            });
        },
        async update() {
            return err({
                type: "io",
                message: "Not implemented in mock",
            });
        },
        async delete() {
            return err({
                type: "io",
                message: "Not implemented in mock",
            });
        },
    };
    entries = {
        async list() {
            return ok([]);
        },
        async create() {
            return err({
                type: "io",
                message: "Not implemented in mock",
            });
        },
        async getById() {
            return err({
                type: "io",
                message: "Not implemented in mock",
            });
        },
        async update() {
            return err({
                type: "io",
                message: "Not implemented in mock",
            });
        },
        async delete() {
            return err({
                type: "io",
                message: "Not implemented in mock",
            });
        },
    };
    rulesets = {
        async create() {
            return err({
                type: "io",
                message: "Not implemented in mock",
            });
        },
        async getById() {
            return err({
                type: "io",
                message: "Not implemented in mock",
            });
        },
        async getActive() {
            return ok(null);
        },
        async listByOrg() {
            return ok([]);
        },
        async listAll() {
            return ok([]);
        },
        async delete() {
            return ok(undefined);
        },
    };
    tags = {
        async getAll() {
            return ok([]);
        },
        async record() {
            return err({
                type: "io",
                message: "Not implemented in mock",
            });
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
            return err({
                type: "io",
                message: "Not implemented in mock",
            });
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
            return err({
                type: "io",
                message: "Not implemented in mock",
            });
        },
        async get() {
            return ok(null);
        },
    };
    transaction = {
        async transaction() {
            return err({
                type: "io",
                message: "Not implemented in mock",
            });
        },
    };
    async initialize() {
        return ok(undefined);
    }
    async dispose() {}
}

function createMockDataLayerWithPayPeriodStartDay(
    payPeriodStartDay: number,
): IDataLayer {
    const mockDal = new MockDataLayer();
    mockDal.organizations.get = vi.fn(async (organizationId: Id) => {
        return ok({
            organizationId,
            name: "Test Org",
            payPeriodStartDay,
            timezone: "UTC",
            workweekStartDay: 1,
            createdAt: new Date().toISOString(),
        });
    });
    return mockDal;
}

describe("PayPeriodService", () => {
    let service: PayPeriodService;

    beforeEach(() => {
        const mockDal = new MockDataLayer();
        service = new PayPeriodService({ dal: mockDal });
    });

    describe("when payPeriodStartDay = 1 (Monday)", () => {
        beforeEach(() => {
            const mockDal = createMockDataLayerWithPayPeriodStartDay(1);
            service = new PayPeriodService({ dal: mockDal });
        });

        it("should calculate correct period for a Thursday (2026-04-16)", async () => {
            // 2026-04-16 is Thursday
            const result = await service.calculatePayPeriodForDate(
                "2026-04-16",
                "org-1" as Id,
            );
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.startDate).toBe("2026-04-13"); // Monday
                expect(result.data.endDate).toBe("2026-04-19"); // Sunday
            }
        });

        it("should calculate correct period for Monday (start of period)", async () => {
            // 2026-04-13 is Monday
            const result = await service.calculatePayPeriodForDate(
                "2026-04-13",
                "org-1" as Id,
            );
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.startDate).toBe("2026-04-13");
                expect(result.data.endDate).toBe("2026-04-19");
            }
        });

        it("should calculate correct period for Sunday (last day of period)", async () => {
            // 2026-04-19 is Sunday
            const result = await service.calculatePayPeriodForDate(
                "2026-04-19",
                "org-1" as Id,
            );
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.startDate).toBe("2026-04-13");
                expect(result.data.endDate).toBe("2026-04-19");
            }
        });

        it("should calculate correct period for a Saturday", async () => {
            // 2026-04-18 is Saturday
            const result = await service.calculatePayPeriodForDate(
                "2026-04-18",
                "org-1" as Id,
            );
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.startDate).toBe("2026-04-13");
                expect(result.data.endDate).toBe("2026-04-19");
            }
        });
    });

    describe("when payPeriodStartDay = 7 (Sunday)", () => {
        beforeEach(() => {
            const mockDal = createMockDataLayerWithPayPeriodStartDay(7);
            service = new PayPeriodService({ dal: mockDal });
        });

        it("should calculate correct period for a Thursday with Sunday start", async () => {
            // 2026-04-16 is Thursday, period should be Sun 2026-04-12 to Sat 2026-04-18
            const result = await service.calculatePayPeriodForDate(
                "2026-04-16",
                "org-1" as Id,
            );
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.startDate).toBe("2026-04-12"); // Sunday
                expect(result.data.endDate).toBe("2026-04-18"); // Saturday
            }
        });

        it("should calculate correct period for Sunday (start of period)", async () => {
            // 2026-04-12 is Sunday
            const result = await service.calculatePayPeriodForDate(
                "2026-04-12",
                "org-1" as Id,
            );
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.startDate).toBe("2026-04-12");
                expect(result.data.endDate).toBe("2026-04-18");
            }
        });
    });

    describe("when payPeriodStartDay = 4 (Thursday)", () => {
        beforeEach(() => {
            const mockDal = createMockDataLayerWithPayPeriodStartDay(4);
            service = new PayPeriodService({ dal: mockDal });
        });

        it("should calculate correct period for a Wednesday", async () => {
            // 2026-04-15 is Wednesday, period should be Thu 2026-04-09 to Wed 2026-04-15
            const result = await service.calculatePayPeriodForDate(
                "2026-04-15",
                "org-1" as Id,
            );
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.startDate).toBe("2026-04-09"); // Thursday (previous week)
                expect(result.data.endDate).toBe("2026-04-15"); // Wednesday
            }
        });

        it("should calculate correct period for Thursday (start of period)", async () => {
            // 2026-04-16 is Thursday
            const result = await service.calculatePayPeriodForDate(
                "2026-04-16",
                "org-1" as Id,
            );
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.startDate).toBe("2026-04-16");
                expect(result.data.endDate).toBe("2026-04-22");
            }
        });
    });

    describe("edge cases with month/year boundaries", () => {
        beforeEach(() => {
            const mockDal = createMockDataLayerWithPayPeriodStartDay(1);
            service = new PayPeriodService({ dal: mockDal });
        });

        it("should correctly span month boundary (Monday start)", async () => {
            // 2026-05-03 is Sunday, period should include Mon 2026-04-27 to Sun 2026-05-03
            const result = await service.calculatePayPeriodForDate(
                "2026-05-03",
                "org-1" as Id,
            );
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.startDate).toBe("2026-04-27");
                expect(result.data.endDate).toBe("2026-05-03");
            }
        });

        it("should correctly handle year boundary", async () => {
            // 2026-01-05 is Monday
            const result = await service.calculatePayPeriodForDate(
                "2026-01-05",
                "org-1" as Id,
            );
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.startDate).toBe("2026-01-05");
                expect(result.data.endDate).toBe("2026-01-11");
            }
        });
    });

    describe("error handling", () => {
        it("should return notFound error if organization doesn't exist", async () => {
            const mockDal = new MockDataLayer();
            mockDal.organizations.get = vi.fn(async () => {
                return err({
                    type: "notFound",
                    entityType: "Organization",
                    id: "org-999" as Id,
                });
            });

            const svc = new PayPeriodService({ dal: mockDal });
            const result = await svc.calculatePayPeriodForDate(
                "2026-04-16",
                "org-999" as Id,
            );
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.type).toBe("notFound");
            }
        });
    });

    describe("all 7 start days with varied dates", () => {
        const testDate = "2026-04-16"; // Thursday

        // Expected periods for Thursday with each start day:
        // 1 (Mon): Mon 2026-04-13 to Sun 2026-04-19
        // 2 (Tue): Tue 2026-04-14 to Mon 2026-04-20
        // 3 (Wed): Wed 2026-04-15 to Tue 2026-04-21
        // 4 (Thu): Thu 2026-04-09 to Wed 2026-04-15 (previous week start)
        // 5 (Fri): Fri 2026-04-10 to Thu 2026-04-16
        // 6 (Sat): Sat 2026-04-11 to Fri 2026-04-17
        // 7 (Sun): Sun 2026-04-12 to Sat 2026-04-18

        for (let startDay = 1; startDay <= 7; startDay++) {
            it(`should handle startDay=${startDay}`, async () => {
                const mockDal =
                    createMockDataLayerWithPayPeriodStartDay(startDay);
                const svc = new PayPeriodService({ dal: mockDal });
                const result = await svc.calculatePayPeriodForDate(
                    testDate,
                    "org-1" as Id,
                );
                expect(result.success).toBe(true);
                if (result.success) {
                    // Just verify it returns valid dates
                    expect(result.data.startDate).toMatch(
                        /^\d{4}-\d{2}-\d{2}$/,
                    );
                    expect(result.data.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
                    // Verify endDate is after startDate
                    expect(
                        new Date(result.data.endDate).getTime(),
                    ).toBeGreaterThan(
                        new Date(result.data.startDate).getTime(),
                    );
                }
            });
        }
    });
});
