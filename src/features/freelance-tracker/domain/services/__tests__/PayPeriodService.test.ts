import { beforeEach, describe, expect, it } from "vitest";
import { PayPeriodService } from "../PayPeriodService";
import { testId } from "../../../test-utils/fixtures";

describe("PayPeriodService", () => {
    const orgId = testId("org");
    let payPeriodStartDay = 1;

    const dal: any = {
        organizations: {
            get: async () => ({
                success: true,
                data: {
                    organizationId: orgId,
                    name: "Org",
                    payPeriodStartDay,
                    createdAt: "2026-01-01T00:00:00.000Z",
                },
            }),
        },
    };

    let service: PayPeriodService;

    beforeEach(() => {
        service = new PayPeriodService({ dal });
    });

    it("calculates Monday-based period correctly for known date", async () => {
        payPeriodStartDay = 1;
        const result = await service.calculatePayPeriodForDate(
            "2026-04-16",
            orgId,
        );

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.data).toEqual({
            startDate: "2026-04-13",
            endDate: "2026-04-19",
        });
    });

    it("calculates Friday-based period correctly for known date", async () => {
        payPeriodStartDay = 5;
        const result = await service.calculatePayPeriodForDate(
            "2026-04-16",
            orgId,
        );

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.data).toEqual({
            startDate: "2026-04-10",
            endDate: "2026-04-16",
        });
    });

    it("covers all 7 possible pay period start days", async () => {
        const results: Array<{
            day: number;
            startDate: string;
            endDate: string;
        }> = [];

        for (const day of [1, 2, 3, 4, 5, 6, 7]) {
            payPeriodStartDay = day;
            const result = await service.calculatePayPeriodForDate(
                "2026-04-16",
                orgId,
            );
            expect(result.success).toBe(true);
            if (result.success) {
                results.push({ day, ...result.data });
            }
        }

        expect(results).toHaveLength(7);
        expect(new Set(results.map((r) => r.startDate)).size).toBeGreaterThan(
            1,
        );
    });

    it("handles month boundary dates", async () => {
        payPeriodStartDay = 1;
        const result = await service.calculatePayPeriodForDate(
            "2026-02-01",
            orgId,
        );

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.data.startDate <= "2026-02-01").toBe(true);
        expect(result.data.endDate >= "2026-02-01").toBe(true);
    });

    it("handles year boundary dates", async () => {
        payPeriodStartDay = 1;
        const result = await service.calculatePayPeriodForDate(
            "2026-01-01",
            orgId,
        );

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(
            result.data.startDate.startsWith("2025") ||
                result.data.startDate.startsWith("2026"),
        ).toBe(true);
        expect(result.data.endDate.startsWith("2026")).toBe(true);
    });

    it("handles leap-year date arithmetic", async () => {
        payPeriodStartDay = 1;
        const result = await service.calculatePayPeriodForDate(
            "2024-02-29",
            orgId,
        );

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.data.startDate <= "2024-02-29").toBe(true);
        expect(result.data.endDate >= "2024-02-29").toBe(true);
    });

    it("propagates organization lookup errors", async () => {
        const failure = { kind: "notFound", message: "org missing" };
        dal.organizations.get = async () => ({
            success: false,
            error: failure,
        });

        const result = await service.calculatePayPeriodForDate(
            "2026-04-16",
            orgId,
        );

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error).toEqual(failure);
        }
    });
});
