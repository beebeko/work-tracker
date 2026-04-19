import { describe, expect, it } from "vitest";
import { GrossPayCalculator } from "../GrossPayCalculator";
import {
    makeEntry,
    makeOrganization,
    testId,
} from "../../../test-utils/fixtures";

describe("GrossPayCalculator", () => {
    const orgA = makeOrganization({ organizationId: testId("org") });
    const orgB = makeOrganization({
        organizationId: testId("org"),
        name: "Org B",
    });

    function createCalculator(
        entriesByOrg: Record<string, any[]>,
        failEntries = false,
        organizations = [orgA, orgB],
        rulesets: any[] = [],
    ) {
        const dal: any = {
            organizations: {
                list: async () => ({ success: true, data: organizations }),
                get: async (orgId: string) => ({
                    success: true,
                    data: organizations.find((o) => o.organizationId === orgId),
                }),
            },
            entries: {
                list: async ({
                    organizationId,
                }: {
                    organizationId: string;
                }) => {
                    if (failEntries) {
                        return {
                            success: false,
                            error: { type: "io", message: "list failed" },
                        };
                    }
                    return {
                        success: true,
                        data: entriesByOrg[organizationId] ?? [],
                    };
                },
            },
            rulesets: {
                getActive: async () => ({ success: true, data: null }),
                getById: async () => ({
                    success: false,
                    error: { type: "notFound" },
                }),
                listByOrg: async () => ({ success: true, data: rulesets }),
            },
        };

        return new GrossPayCalculator({ dal });
    }

    it("calculates pay and hours for rated entries", async () => {
        const entries = [
            makeEntry({
                organizationId: orgA.organizationId,
                entryId: testId("entry"),
                startTime: "09:00",
                endTime: "10:00",
                rate: 20,
            }),
            makeEntry({
                organizationId: orgA.organizationId,
                entryId: testId("entry"),
                startTime: "10:00",
                endTime: "11:00",
                rate: 20,
            }),
            makeEntry({
                organizationId: orgA.organizationId,
                entryId: testId("entry"),
                startTime: "11:00",
                endTime: "12:00",
                rate: 20,
            }),
        ];

        const calculator = createCalculator({ [orgA.organizationId]: entries });
        const result = await calculator.calculateGrossPayForPeriod(
            orgA.organizationId,
            {
                startDate: "2026-04-13",
                endDate: "2026-04-19",
            },
        );

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.data.totalPay).toBe(60);
        expect(result.data.totalHours).toBe(3);
        expect(result.data.entriesWithoutRate).toBe(0);
    });

    it("handles mixed rated and unrated entries", async () => {
        const entries = [
            makeEntry({
                organizationId: orgA.organizationId,
                rate: 30,
                startTime: "09:00",
                endTime: "10:00",
            }),
            makeEntry({
                organizationId: orgA.organizationId,
                rate: 25,
                startTime: "10:00",
                endTime: "12:00",
            }),
            makeEntry({
                organizationId: orgA.organizationId,
                rate: null,
                startTime: "12:00",
                endTime: "13:00",
            }),
        ];

        const calculator = createCalculator({ [orgA.organizationId]: entries });
        const result = await calculator.calculateGrossPayForPeriod(
            orgA.organizationId,
            {
                startDate: "2026-04-13",
                endDate: "2026-04-19",
            },
        );

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.data.totalPay).toBe(80);
        expect(result.data.entriesWithoutRate).toBe(1);
        expect(result.data.breakdown.some((b) => b.pay === null)).toBe(true);
    });

    it("uses flatFeeAmount as base pay for flat-fee shifts and derives effective rate", async () => {
        const entries = [
            makeEntry({
                organizationId: orgA.organizationId,
                startTime: "09:00",
                endTime: "15:00", // 6 hours
                paymentMode: "flat-fee",
                flatFeeAmount: 300,
                rate: null,
            }),
        ];

        const calculator = createCalculator({ [orgA.organizationId]: entries });
        const result = await calculator.calculateGrossPayForPeriod(
            orgA.organizationId,
            {
                startDate: "2026-04-13",
                endDate: "2026-04-19",
            },
        );

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.data.totalPay).toBe(300);
        expect(result.data.totalHours).toBe(6);
        expect(result.data.entriesWithoutRate).toBe(0);
        expect(result.data.breakdown[0]!.rate).toBeCloseTo(50);
        expect(result.data.breakdown[0]!.pay).toBe(300);
    });

    it("aggregates mixed hourly and flat-fee periods correctly", async () => {
        const entries = [
            makeEntry({
                organizationId: orgA.organizationId,
                startTime: "09:00",
                endTime: "11:00",
                paymentMode: "hourly",
                rate: 50,
            }),
            makeEntry({
                organizationId: orgA.organizationId,
                startTime: "12:00",
                endTime: "15:00",
                paymentMode: "flat-fee",
                flatFeeAmount: 180,
                rate: null,
            }),
        ];

        const calculator = createCalculator({ [orgA.organizationId]: entries });
        const result = await calculator.calculateGrossPayForPeriod(
            orgA.organizationId,
            {
                startDate: "2026-04-13",
                endDate: "2026-04-19",
            },
        );

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.data.totalPay).toBe(280); // 2h*50 + 180
        expect(result.data.totalHours).toBe(5);
        expect(result.data.entriesWithoutRate).toBe(0);
        expect(result.data.breakdown).toHaveLength(2);
    });

    it("safely resolves zero-duration flat-fee effective rate to 0", async () => {
        const entries = [
            makeEntry({
                organizationId: orgA.organizationId,
                startTime: "09:00",
                endTime: "09:00",
                paymentMode: "flat-fee",
                flatFeeAmount: 120,
                rate: null,
            }),
        ];

        const calculator = createCalculator({ [orgA.organizationId]: entries });
        const result = await calculator.calculateGrossPayForPeriod(
            orgA.organizationId,
            {
                startDate: "2026-04-13",
                endDate: "2026-04-19",
            },
        );

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.data.totalHours).toBe(0);
        expect(result.data.totalPay).toBe(120);
        expect(result.data.breakdown[0]!.rate).toBe(0);
    });

    it("calculates quarter and half hour correctly", async () => {
        const entries = [
            makeEntry({
                organizationId: orgA.organizationId,
                startTime: "09:00",
                endTime: "09:15",
                rate: 40,
            }),
            makeEntry({
                organizationId: orgA.organizationId,
                startTime: "09:15",
                endTime: "09:45",
                rate: 40,
            }),
        ];

        const calculator = createCalculator({ [orgA.organizationId]: entries });
        const result = await calculator.calculateGrossPayForPeriod(
            orgA.organizationId,
            {
                startDate: "2026-04-13",
                endDate: "2026-04-19",
            },
        );

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.data.totalHours).toBe(0.75);
        expect(result.data.totalPay).toBe(30);
    });

    it("calculates cumulative pay across organizations", async () => {
        const calculator = createCalculator({
            [orgA.organizationId]: [
                makeEntry({
                    organizationId: orgA.organizationId,
                    rate: 50,
                    startTime: "09:00",
                    endTime: "11:00",
                }),
            ],
            [orgB.organizationId]: [
                makeEntry({
                    organizationId: orgB.organizationId,
                    rate: 75,
                    startTime: "10:00",
                    endTime: "12:00",
                }),
            ],
        });

        const result = await calculator.calculateGrossPayForPeriod(
            orgA.organizationId,
            {
                startDate: "2026-04-13",
                endDate: "2026-04-19",
            },
        );

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.data.totalPay).toBe(100);
        expect(result.data.cumulativePay).toBe(250);
    });

    it("propagates DAL list errors", async () => {
        const calculator = createCalculator({}, true);
        const result = await calculator.calculateGrossPayForPeriod(
            orgA.organizationId,
            {
                startDate: "2026-04-13",
                endDate: "2026-04-19",
            },
        );

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.type).toBe("io");
        }
    });

    describe("F-001 ruleset integration", () => {
        it("returns base pay only with empty ruleLines when no ruleset is active", async () => {
            const entries = [
                makeEntry({
                    organizationId: orgA.organizationId,
                    startTime: "09:00",
                    endTime: "18:00", // 9h
                    rate: 50,
                }),
            ];

            // rulesets = [] → no active ruleset
            const calculator = createCalculator(
                { [orgA.organizationId]: entries },
                false,
                [orgA, orgB],
                [],
            );
            const result = await calculator.calculateGrossPayForPeriod(
                orgA.organizationId,
                { startDate: "2026-04-13", endDate: "2026-04-19" },
            );

            expect(result.success).toBe(true);
            if (!result.success) return;
            expect(result.data.ruleLines).toHaveLength(0);
            expect(result.data.rulePremiumAmount).toBe(0);
            expect(result.data.totalPay).toBe(450); // 9h × $50
            expect(result.data.totalWithPremiums).toBe(450);
        });

        it("uses the correct ruleset version per entry date when the period spans multiple effective dates", async () => {
            // rulesetA: eff Apr 1, daily-OT threshold = 8h → 1h OT for a 9h entry
            // rulesetB: eff Apr 15, daily-OT threshold = 10h → no OT for a 9h entry
            const rulesetAId = testId("ruleset");
            const rulesetBId = testId("ruleset");

            const rulesetA = {
                rulesetId: rulesetAId,
                organizationId: orgA.organizationId,
                effectiveDate: "2026-04-01",
                rules: [
                    {
                        ruleId: testId("rule"),
                        type: "daily-overtime",
                        description: "OT after 8h",
                        dailyThresholdHours: 8,
                        multiplier: 1.5,
                    },
                ],
                createdAt: "2026-04-01T00:00:00.000Z",
            };

            const rulesetB = {
                rulesetId: rulesetBId,
                organizationId: orgA.organizationId,
                effectiveDate: "2026-04-15",
                rules: [
                    {
                        ruleId: testId("rule"),
                        type: "daily-overtime",
                        description: "OT after 10h",
                        dailyThresholdHours: 10,
                        multiplier: 1.5,
                    },
                ],
                createdAt: "2026-04-15T00:00:00.000Z",
            };

            // Apr 14 entry: 9h, falls under rulesetA (8h threshold) → 1h OT premium = 1×50×0.5 = $25
            // Apr 15 entry: 9h, falls under rulesetB (10h threshold) → 0h OT premium
            const entries = [
                makeEntry({
                    organizationId: orgA.organizationId,
                    dateWorked: "2026-04-14",
                    startTime: "09:00",
                    endTime: "18:00",
                    rate: 50,
                }),
                makeEntry({
                    organizationId: orgA.organizationId,
                    dateWorked: "2026-04-15",
                    startTime: "09:00",
                    endTime: "18:00",
                    rate: 50,
                }),
            ];

            // DAL returns rulesets newest-first
            const calculator = createCalculator(
                { [orgA.organizationId]: entries },
                false,
                [orgA, orgB],
                [rulesetB, rulesetA],
            );

            const result = await calculator.calculateGrossPayForPeriod(
                orgA.organizationId,
                { startDate: "2026-04-13", endDate: "2026-04-19" },
            );

            expect(result.success).toBe(true);
            if (!result.success) return;

            // Only the Apr 14 entry triggers OT premium ($25); Apr 15 entry does not
            expect(result.data.rulePremiumAmount).toBeCloseTo(25);
            expect(result.data.ruleLines).toHaveLength(1);
            expect(result.data.ruleLines[0]!.totalPremiumHours).toBeCloseTo(1);
        });

        it("propagates rule description into ruleLines ruleLabel", async () => {
            const rulesetId = testId("ruleset");
            const ruleset = {
                rulesetId,
                organizationId: orgA.organizationId,
                effectiveDate: "2026-04-01",
                rules: [
                    {
                        ruleId: testId("rule"),
                        type: "daily-overtime",
                        description: "Time and a Half After 8h",
                        dailyThresholdHours: 8,
                        multiplier: 1.5,
                    },
                ],
                createdAt: "2026-04-01T00:00:00.000Z",
            };

            const entries = [
                makeEntry({
                    organizationId: orgA.organizationId,
                    dateWorked: "2026-04-14",
                    startTime: "09:00",
                    endTime: "18:00", // 9h → 1h OT
                    rate: 50,
                }),
            ];

            const calculator = createCalculator(
                { [orgA.organizationId]: entries },
                false,
                [orgA, orgB],
                [ruleset],
            );

            const result = await calculator.calculateGrossPayForPeriod(
                orgA.organizationId,
                { startDate: "2026-04-13", endDate: "2026-04-19" },
            );

            expect(result.success).toBe(true);
            if (!result.success) return;
            expect(result.data.ruleLines).toHaveLength(1);
            expect(result.data.ruleLines[0]!.ruleLabel).toBe(
                "Time and a Half After 8h",
            );
        });

        it("surfaces unrated entries in ruleLines and ruleWarnings when rate is null", async () => {
            const ruleset = {
                rulesetId: testId("ruleset"),
                organizationId: orgA.organizationId,
                effectiveDate: "2026-04-01",
                rules: [
                    {
                        ruleId: testId("rule"),
                        type: "daily-overtime",
                        dailyThresholdHours: 8,
                        multiplier: 1.5,
                    },
                ],
                createdAt: "2026-04-01T00:00:00.000Z",
            };

            const entries = [
                makeEntry({
                    organizationId: orgA.organizationId,
                    dateWorked: "2026-04-14",
                    startTime: "09:00",
                    endTime: "18:00", // 9h → qualifies for OT but has no rate
                    rate: null,
                }),
            ];

            const calculator = createCalculator(
                { [orgA.organizationId]: entries },
                false,
                [orgA, orgB],
                [ruleset],
            );

            const result = await calculator.calculateGrossPayForPeriod(
                orgA.organizationId,
                { startDate: "2026-04-13", endDate: "2026-04-19" },
            );

            expect(result.success).toBe(true);
            if (!result.success) return;

            // No dollar premium calculable (rate is null) but the line should still appear
            expect(result.data.ruleLines).toHaveLength(1);
            expect(result.data.ruleLines[0]!.unratedEntryCount).toBeGreaterThan(
                0,
            );
            // At least one warning about lack of rates
            const allWarnings = [
                ...result.data.ruleWarnings,
                ...result.data.ruleLines.flatMap((l) => l.warnings),
            ];
            expect(
                allWarnings.some(
                    (w) =>
                        w.includes("lack rates") ||
                        w.includes("unrated") ||
                        w.includes("rates"),
                ),
            ).toBe(true);
        });

        it("applies overtime premiums on top of flat-fee base pay", async () => {
            const ruleset = {
                rulesetId: testId("ruleset"),
                organizationId: orgA.organizationId,
                effectiveDate: "2026-04-01",
                rules: [
                    {
                        ruleId: testId("rule"),
                        type: "daily-overtime",
                        dailyThresholdHours: 8,
                        multiplier: 1.5,
                    },
                ],
                createdAt: "2026-04-01T00:00:00.000Z",
            };

            const entries = [
                makeEntry({
                    organizationId: orgA.organizationId,
                    dateWorked: "2026-04-14",
                    startTime: "09:00",
                    endTime: "19:00", // 10h
                    paymentMode: "flat-fee",
                    flatFeeAmount: 300,
                    rate: null,
                }),
            ];

            const calculator = createCalculator(
                { [orgA.organizationId]: entries },
                false,
                [orgA, orgB],
                [ruleset],
            );

            const result = await calculator.calculateGrossPayForPeriod(
                orgA.organizationId,
                { startDate: "2026-04-13", endDate: "2026-04-19" },
            );

            expect(result.success).toBe(true);
            if (!result.success) return;
            expect(result.data.totalPay).toBe(300);
            expect(result.data.rulePremiumAmount).toBeCloseTo(30);
            expect(result.data.totalWithPremiums).toBeCloseTo(330);
        });
    });
});
