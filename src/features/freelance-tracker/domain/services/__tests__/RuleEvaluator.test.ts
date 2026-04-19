/**
 * Unit tests for RuleEvaluator
 * Tests midnight splitting, daily OT, weekly OT, custom rules, and additive overlaps
 */

import { describe, it, expect } from "vitest";
import { RuleEvaluator } from "../RuleEvaluator";
import type {
    Entry,
    DailyOvertimeRule,
    WeeklyOvertimeRule,
    CustomRule,
    HolidayRateRule,
    Id,
} from "@/features/freelance-tracker/contracts/types";
import {
    testId,
    makeEntry,
} from "@/features/freelance-tracker/test-utils/fixtures";

// Test helpers
function createTestEntry(overrides?: Partial<Entry>): Entry {
    return makeEntry(overrides);
}

describe("RuleEvaluator", () => {
    describe("splitAtMidnight", () => {
        it("should not split shifts that do not cross midnight", () => {
            const entry = createTestEntry({
                startTime: "09:00",
                endTime: "17:00",
            });
            const shifts = RuleEvaluator.splitAtMidnight(entry);
            expect(shifts).toHaveLength(1);
            expect(shifts[0]!.durationMinutes).toBe(8 * 60); // 8 hours
            expect(shifts[0]!.shiftDate).toBe("2026-04-14");
        });

        it("should split shifts that cross midnight", () => {
            const entry = createTestEntry({
                startTime: "22:00",
                endTime: "06:00",
            });
            const shifts = RuleEvaluator.splitAtMidnight(entry);
            expect(shifts).toHaveLength(2);

            // Part 1: 22:00 to midnight = 2 hours
            expect(shifts[0]!.durationMinutes).toBe(2 * 60);
            expect(shifts[0]!.shiftDate).toBe("2026-04-14");

            // Part 2: midnight to 06:00 = 6 hours
            expect(shifts[1]!.durationMinutes).toBe(6 * 60);
            expect(shifts[1]!.shiftDate).toBe("2026-04-15");
        });

        it("should preserve entry metadata across midnight split", () => {
            const entry = createTestEntry({
                startTime: "23:00",
                endTime: "02:00",
                position: "Cook",
                rate: 25,
                tags: ["meal"],
            });
            const shifts = RuleEvaluator.splitAtMidnight(entry);

            for (const shift of shifts) {
                expect(shift.position).toBe("Cook");
                expect(shift.rate).toBe(25);
                expect(shift.tags).toEqual(["meal"]);
                expect(shift.entryId).toBe(entry.entryId);
            }
        });

        it("should correctly split a 23:59 → 00:01 shift (1 min each side)", () => {
            const entry = createTestEntry({
                dateWorked: "2026-04-14",
                startTime: "23:59",
                endTime: "00:01",
            });
            const shifts = RuleEvaluator.splitAtMidnight(entry);
            expect(shifts).toHaveLength(2);
            expect(shifts[0]!.durationMinutes).toBe(1); // 23:59 → midnight
            expect(shifts[0]!.shiftDate).toBe("2026-04-14");
            expect(shifts[1]!.durationMinutes).toBe(1); // midnight → 00:01
            expect(shifts[1]!.shiftDate).toBe("2026-04-15");
        });

        it("should not split a shift starting exactly at midnight (00:00)", () => {
            const entry = createTestEntry({
                dateWorked: "2026-04-14",
                startTime: "00:00",
                endTime: "06:00",
            });
            const shifts = RuleEvaluator.splitAtMidnight(entry);
            expect(shifts).toHaveLength(1);
            expect(shifts[0]!.durationMinutes).toBe(6 * 60);
            expect(shifts[0]!.shiftDate).toBe("2026-04-14");
        });

        it("should produce correct dates when splitting across a year boundary", () => {
            const entry = createTestEntry({
                dateWorked: "2025-12-31",
                startTime: "22:00",
                endTime: "02:00",
            });
            const shifts = RuleEvaluator.splitAtMidnight(entry);
            expect(shifts).toHaveLength(2);
            expect(shifts[0]!.shiftDate).toBe("2025-12-31");
            expect(shifts[0]!.durationMinutes).toBe(2 * 60); // 22:00→midnight
            expect(shifts[1]!.shiftDate).toBe("2026-01-01");
            expect(shifts[1]!.durationMinutes).toBe(2 * 60); // midnight→02:00
        });

        it("should reference the same entryId in both halves of a midnight split", () => {
            const entry = createTestEntry({
                startTime: "22:00",
                endTime: "04:00",
            });
            const shifts = RuleEvaluator.splitAtMidnight(entry);
            expect(shifts[0]!.entryId).toBe(entry.entryId);
            expect(shifts[1]!.entryId).toBe(entry.entryId);
        });

        it("should safely resolve flat-fee effective rate to 0 for zero-duration shifts", () => {
            const entry = createTestEntry({
                startTime: "09:00",
                endTime: "09:00",
                paymentMode: "flat-fee",
                flatFeeAmount: 250,
                rate: null,
            });

            const shifts = RuleEvaluator.splitAtMidnight(entry);
            expect(shifts).toHaveLength(1);
            expect(shifts[0]!.durationMinutes).toBe(0);
            expect(shifts[0]!.rate).toBe(0);
        });
    });

    describe("evaluateDailyOT", () => {
        it("should calculate OT for hours over daily threshold", () => {
            const rule: DailyOvertimeRule = {
                ruleId: testId("rule"),
                type: "daily-overtime",
                dailyThresholdHours: 8,
                multiplier: 1.5,
            };

            const shift = RuleEvaluator.splitAtMidnight(
                createTestEntry({
                    startTime: "09:00",
                    endTime: "18:00", // 9 hours
                    rate: 50,
                }),
            )[0]!;

            const premiums = RuleEvaluator.evaluateDailyOT(rule, [shift]);
            expect(premiums).toHaveLength(1);

            const premium = premiums[0]!;
            expect(premium.premiumHours).toBe(1); // 1 hour over 8h threshold
            expect(premium.premiumAmount).toBe(50 * (1.5 - 1)); // 1 hour * 50 * 0.5
            expect(premium.multiplier).toBe(1.5);
        });

        it("should not calculate OT for hours under daily threshold", () => {
            const rule: DailyOvertimeRule = {
                ruleId: testId("rule"),
                type: "daily-overtime",
                dailyThresholdHours: 8,
                multiplier: 1.5,
            };

            const shift = RuleEvaluator.splitAtMidnight(
                createTestEntry({
                    startTime: "09:00",
                    endTime: "17:00", // 8 hours
                    rate: 50,
                }),
            )[0]!;

            const premiums = RuleEvaluator.evaluateDailyOT(rule, [shift]);
            expect(premiums).toHaveLength(0);
        });

        it("should handle unrated entries gracefully", () => {
            const rule: DailyOvertimeRule = {
                ruleId: testId("rule"),
                type: "daily-overtime",
                dailyThresholdHours: 8,
                multiplier: 1.5,
            };

            const shift = RuleEvaluator.splitAtMidnight(
                createTestEntry({
                    startTime: "09:00",
                    endTime: "18:00",
                    rate: null, // unrated
                }),
            )[0]!;

            const premiums = RuleEvaluator.evaluateDailyOT(rule, [shift]);
            expect(premiums).toHaveLength(1);
            expect(premiums[0]!.premiumAmount).toBeNull();
            expect(premiums[0]!.premiumHours).toBe(1);
        });

        it("should accumulate hours across multiple shifts in a day", () => {
            const rule: DailyOvertimeRule = {
                ruleId: testId("rule"),
                type: "daily-overtime",
                dailyThresholdHours: 8,
                multiplier: 1.5,
            };

            const shift1 = RuleEvaluator.splitAtMidnight(
                createTestEntry({
                    startTime: "09:00",
                    endTime: "13:00", // 4 hours
                    rate: 50,
                }),
            )[0]!;

            const shift2 = RuleEvaluator.splitAtMidnight(
                createTestEntry({
                    startTime: "14:00",
                    endTime: "20:00", // 6 hours, total 10h for day
                    rate: 50,
                }),
            )[0]!;

            const premiums = RuleEvaluator.evaluateDailyOT(rule, [
                shift1,
                shift2,
            ]);
            expect(premiums).toHaveLength(1); // Only shift2 has OT (2 hours)
            expect(premiums[0]!.premiumHours).toBe(2);
        });

        it("should use the description field as ruleLabel when provided", () => {
            const rule: DailyOvertimeRule = {
                ruleId: testId("rule"),
                type: "daily-overtime",
                description: "Time and a Half After 8h",
                dailyThresholdHours: 8,
                multiplier: 1.5,
            };

            const shift = RuleEvaluator.splitAtMidnight(
                createTestEntry({
                    startTime: "09:00",
                    endTime: "18:00",
                    rate: 50,
                }),
            )[0]!;

            const premiums = RuleEvaluator.evaluateDailyOT(rule, [shift]);
            expect(premiums[0]!.ruleLabel).toBe("Time and a Half After 8h");
        });

        it("should use a formatted fallback ruleLabel when description is absent", () => {
            const rule: DailyOvertimeRule = {
                ruleId: testId("rule"),
                type: "daily-overtime",
                dailyThresholdHours: 10,
                multiplier: 2,
            };

            const shift = RuleEvaluator.splitAtMidnight(
                createTestEntry({
                    startTime: "09:00",
                    endTime: "20:00",
                    rate: 50,
                }),
            )[0]!;

            const premiums = RuleEvaluator.evaluateDailyOT(rule, [shift]);
            expect(premiums[0]!.ruleLabel).toBe("Daily OT (10h @ 2x)");
        });

        it("should apply overtime premium on top of flat-fee shifts using derived effective rate", () => {
            const rule: DailyOvertimeRule = {
                ruleId: testId("rule"),
                type: "daily-overtime",
                dailyThresholdHours: 8,
                multiplier: 1.5,
            };

            const shift = RuleEvaluator.splitAtMidnight(
                createTestEntry({
                    startTime: "09:00",
                    endTime: "19:00", // 10h
                    paymentMode: "flat-fee",
                    flatFeeAmount: 300,
                    rate: null,
                }),
            )[0]!;

            const premiums = RuleEvaluator.evaluateDailyOT(rule, [shift]);
            expect(premiums).toHaveLength(1);
            expect(premiums[0]!.premiumHours).toBe(2);
            // Effective rate: 300 / 10 = 30, premium: 2 * 30 * 0.5 = 30
            expect(premiums[0]!.premiumAmount).toBeCloseTo(30);
        });
    });

    describe("evaluateWeeklyOT", () => {
        it("should calculate OT for hours over weekly threshold", () => {
            const rule: WeeklyOvertimeRule = {
                ruleId: testId("rule"),
                type: "weekly-overtime",
                weeklyThresholdHours: 40,
                multiplier: 1.5,
            };

            // Create 5 shifts of 10 hours each = 50 total
            const shifts = [];
            for (let i = 0; i < 5; i++) {
                const date = new Date("2026-04-14");
                date.setDate(date.getDate() + i);
                const dateStr = date.toISOString().split("T")[0]!;

                const entry = createTestEntry({
                    dateWorked: dateStr,
                    startTime: "08:00",
                    endTime: "18:00", // 10 hours each
                    rate: 50,
                });
                shifts.push(...RuleEvaluator.splitAtMidnight(entry));
            }

            const premiums = RuleEvaluator.evaluateWeeklyOT(rule, shifts, 1);
            expect(premiums.length).toBeGreaterThan(0);

            const totalPremiumHours = premiums.reduce(
                (sum, p) => sum + p.premiumHours,
                0,
            );
            expect(totalPremiumHours).toBe(10); // 50 hours - 40 threshold
        });

        it("should use the description field as ruleLabel in weekly OT premiums", () => {
            const rule: WeeklyOvertimeRule = {
                ruleId: testId("rule"),
                type: "weekly-overtime",
                description: "Weekly Time and a Half",
                weeklyThresholdHours: 40,
                multiplier: 1.5,
            };

            // 5 × 9h shifts = 45h total (5h OT)
            const shifts = [0, 1, 2, 3, 4].map((i) => {
                const d = new Date("2026-04-14");
                d.setDate(d.getDate() + i);
                const dateStr = d.toISOString().split("T")[0]!;
                return RuleEvaluator.splitAtMidnight(
                    createTestEntry({
                        dateWorked: dateStr,
                        startTime: "09:00",
                        endTime: "18:00",
                        rate: 50,
                    }),
                )[0]!;
            });

            const premiums = RuleEvaluator.evaluateWeeklyOT(rule, shifts, 1);
            expect(premiums.length).toBeGreaterThan(0);
            expect(premiums[0]!.ruleLabel).toBe("Weekly Time and a Half");
        });
    });

    describe("evaluateCustomRule", () => {
        it("should apply custom rule on position match with multiplier", () => {
            const rule: CustomRule = {
                ruleId: testId("rule"),
                type: "custom",
                scope: "position",
                condition: { matches: ["Chef", "Cook"] },
                payout: { type: "multiplier", value: 1.25 },
            };

            const shifts = RuleEvaluator.splitAtMidnight(
                createTestEntry({
                    position: "Chef",
                    startTime: "09:00",
                    endTime: "17:00",
                    rate: 50,
                }),
            );

            const premiums = RuleEvaluator.evaluateCustomRule(rule, shifts);
            expect(premiums).toHaveLength(1);
            expect(premiums[0]!.premiumHours).toBe(8);
            expect(premiums[0]!.multiplier).toBe(1.25);
            expect(premiums[0]!.premiumAmount).toBe(50 * 8 * 0.25);
        });

        it("should apply custom rule on tag match", () => {
            const rule: CustomRule = {
                ruleId: testId("rule"),
                type: "custom",
                scope: "tag",
                condition: { matches: ["meal-penalty"] },
                payout: { type: "multiplier", value: 1.5 },
            };

            const shifts = RuleEvaluator.splitAtMidnight(
                createTestEntry({
                    tags: ["meal-penalty"],
                    rate: 50,
                }),
            );

            const premiums = RuleEvaluator.evaluateCustomRule(rule, shifts);
            expect(premiums).toHaveLength(1);
            expect(premiums[0]!.multiplier).toBe(1.5);
        });

        it("should apply custom rule on event match", () => {
            const rule: CustomRule = {
                ruleId: testId("rule"),
                type: "custom",
                scope: "event",
                condition: { matches: ["Wedding"] },
                payout: { type: "multiplier", value: 1.75 },
            };

            const shifts = RuleEvaluator.splitAtMidnight(
                createTestEntry({
                    event: "Wedding",
                    rate: 50,
                }),
            );

            const premiums = RuleEvaluator.evaluateCustomRule(rule, shifts);
            expect(premiums).toHaveLength(1);
            expect(premiums[0]!.multiplier).toBe(1.75);
        });

        it("should apply custom rule on date range match", () => {
            const rule: CustomRule = {
                ruleId: testId("rule"),
                type: "custom",
                scope: "date-range",
                condition: {
                    startDate: "2026-04-01",
                    endDate: "2026-04-30",
                },
                payout: { type: "multiplier", value: 1.1 },
            };

            const shifts = RuleEvaluator.splitAtMidnight(
                createTestEntry({
                    dateWorked: "2026-04-14",
                    rate: 50,
                }),
            );

            const premiums = RuleEvaluator.evaluateCustomRule(rule, shifts);
            expect(premiums).toHaveLength(1);
            expect(premiums[0]!.multiplier).toBe(1.1);
        });
    });

    describe("evaluateRules - additive overlaps and warnings", () => {
        it("should detect overlapping rules and generate warnings", () => {
            const dailyRule: DailyOvertimeRule = {
                ruleId: testId("daily-ot"),
                type: "daily-overtime",
                dailyThresholdHours: 8,
                multiplier: 1.5,
            };

            const customRule: CustomRule = {
                ruleId: testId("custom"),
                type: "custom",
                scope: "position",
                condition: { matches: ["Lead"] },
                payout: { type: "multiplier", value: 1.25 },
            };

            const entry = createTestEntry({
                position: "Lead",
                startTime: "09:00",
                endTime: "18:00", // 9 hours = 1h daily OT
                rate: 50,
            });

            const result = RuleEvaluator.evaluateRules(
                [entry],
                [dailyRule, customRule],
                1,
            );

            // Should have premiums from both rules
            expect(result.premiums.length).toBeGreaterThanOrEqual(1);
            expect(result.unratedWarnings.length).toBeGreaterThan(0);
        });

        it("should warn about unrated entries in summary lines", () => {
            const dailyRule: DailyOvertimeRule = {
                ruleId: testId("daily-ot"),
                type: "daily-overtime",
                dailyThresholdHours: 8,
                multiplier: 1.5,
            };

            const entry = createTestEntry({
                startTime: "09:00",
                endTime: "18:00",
                rate: null, // unrated
            });

            const result = RuleEvaluator.evaluateRules([entry], [dailyRule], 1);

            const summaryLine = result.summaryLines.find(
                (line) => line.ruleType === "daily-overtime",
            );
            expect(summaryLine).toBeDefined();
            expect(summaryLine!.unratedEntryCount).toBeGreaterThan(0);
            expect(
                summaryLine!.warnings.some((w) => w.includes("lack rates")),
            ).toBe(true);
        });
    });

    describe("evaluateRules - summary line aggregation", () => {
        it("should aggregate premiums into summary lines by rule", () => {
            const rule: DailyOvertimeRule = {
                ruleId: testId("daily-ot"),
                type: "daily-overtime",
                dailyThresholdHours: 8,
                multiplier: 1.5,
            };

            const entries = [
                createTestEntry({
                    dateWorked: "2026-04-14",
                    startTime: "09:00",
                    endTime: "18:00",
                    rate: 50,
                }),
                createTestEntry({
                    dateWorked: "2026-04-15",
                    startTime: "09:00",
                    endTime: "19:00",
                    rate: 50,
                }),
            ];

            const result = RuleEvaluator.evaluateRules(entries, [rule], 1);

            expect(result.summaryLines).toHaveLength(1);
            const line = result.summaryLines[0]!;
            expect(line.ruleType).toBe("daily-overtime");
            expect(line.totalPremiumHours).toBe(3); // 1h (Apr 14, 9h shift) + 2h (Apr 15, 10h shift)
            expect(line.totalPremiumAmount).toBeCloseTo(
                1 * 50 * 0.5 + 2 * 50 * 0.5, // $25 + $50 = $75
            );
        });
    });

    describe("evaluateMealPenalty", () => {
        it("should apply flat penalty for each meal penalty count", () => {
            const rule: import("@/features/freelance-tracker/contracts/types").MealPenaltyRule =
                {
                    ruleId: testId("rule"),
                    type: "meal-penalty",
                    description: "Meal Penalty ($30)",
                    penaltyAmount: 30,
                };

            const entries = [
                createTestEntry({ mealPenaltyCount: 2, rate: 50 }),
                createTestEntry({ mealPenaltyCount: 0, rate: 50 }),
            ];

            const premiums = RuleEvaluator.evaluateMealPenalty(rule, entries);
            expect(premiums).toHaveLength(1);
            expect(premiums[0]!.premiumAmount).toBe(60); // 30 * 2
            expect(premiums[0]!.premiumHours).toBe(0);
            expect(premiums[0]!.ruleLabel).toBe("Meal Penalty ($30)");
        });

        it("should use fallback label when no description provided", () => {
            const rule: import("@/features/freelance-tracker/contracts/types").MealPenaltyRule =
                {
                    ruleId: testId("rule"),
                    type: "meal-penalty",
                    penaltyAmount: 50,
                };

            const entries = [createTestEntry({ mealPenaltyCount: 1 })];
            const premiums = RuleEvaluator.evaluateMealPenalty(rule, entries);
            expect(premiums[0]!.ruleLabel).toBe("Meal Penalty");
        });
    });

    describe("evaluateHolidayRate", () => {
        it("should apply multiplier to all hours on a holiday date", () => {
            const rule: import("@/features/freelance-tracker/contracts/types").HolidayRateRule =
                {
                    ruleId: testId("rule"),
                    type: "holiday-rate",
                    description: "Holiday Double Time",
                    holidayDates: ["2026-04-14"],
                    multiplier: 2.0,
                };

            const shifts = RuleEvaluator.splitAtMidnight(
                createTestEntry({
                    dateWorked: "2026-04-14",
                    startTime: "09:00",
                    endTime: "17:00", // 8 hours
                    rate: 50,
                }),
            );

            const premiums = RuleEvaluator.evaluateHolidayRate(rule, shifts);
            expect(premiums).toHaveLength(1);
            expect(premiums[0]!.premiumHours).toBe(8);
            expect(premiums[0]!.premiumAmount).toBe(8 * 50 * (2.0 - 1)); // 400
            expect(premiums[0]!.multiplier).toBe(2.0);
        });

        it("should not fire on non-holiday dates", () => {
            const rule: import("@/features/freelance-tracker/contracts/types").HolidayRateRule =
                {
                    ruleId: testId("rule"),
                    type: "holiday-rate",
                    holidayDates: ["2026-04-15"],
                    multiplier: 2.0,
                };

            const shifts = RuleEvaluator.splitAtMidnight(
                createTestEntry({ dateWorked: "2026-04-14", rate: 50 }),
            );

            const premiums = RuleEvaluator.evaluateHolidayRate(rule, shifts);
            expect(premiums).toHaveLength(0);
        });
    });

    describe("evaluateTimeWindowMultiplier", () => {
        it("should apply multiplier to hours within a contiguous window", () => {
            const rule: import("@/features/freelance-tracker/contracts/types").TimeWindowMultiplierRule =
                {
                    ruleId: testId("rule"),
                    type: "time-window-multiplier",
                    description: "Early Call (before 08:00)",
                    windowStart: "00:00",
                    windowEnd: "08:00",
                    multiplier: 1.25,
                };

            // Shift 06:00–10:00 → 2 hours in window [00:00–08:00)
            const shifts = RuleEvaluator.splitAtMidnight(
                createTestEntry({
                    startTime: "06:00",
                    endTime: "10:00",
                    rate: 40,
                }),
            );

            const premiums = RuleEvaluator.evaluateTimeWindowMultiplier(
                rule,
                shifts,
            );
            expect(premiums).toHaveLength(1);
            expect(premiums[0]!.premiumHours).toBeCloseTo(2);
            expect(premiums[0]!.premiumAmount).toBeCloseTo(2 * 40 * 0.25);
        });

        it("should apply multiplier to hours in an overnight-wrapping window", () => {
            const rule: import("@/features/freelance-tracker/contracts/types").TimeWindowMultiplierRule =
                {
                    ruleId: testId("rule"),
                    type: "time-window-multiplier",
                    description: "Late Night (22:00–06:00)",
                    windowStart: "22:00",
                    windowEnd: "06:00", // wraps overnight
                    multiplier: 1.5,
                };

            // Shift 20:00–midnight on the same day (first segment of a midnight-crossing shift)
            const shifts = RuleEvaluator.splitAtMidnight(
                createTestEntry({
                    startTime: "20:00",
                    endTime: "23:00", // 3 hours; 1h in window [22:00–24:00)
                    rate: 30,
                }),
            );

            const premiums = RuleEvaluator.evaluateTimeWindowMultiplier(
                rule,
                shifts,
            );
            expect(premiums).toHaveLength(1);
            expect(premiums[0]!.premiumHours).toBeCloseTo(1); // 22:00–23:00
            expect(premiums[0]!.premiumAmount).toBeCloseTo(1 * 30 * 0.5);
        });

        it("should return no premium when shift is entirely outside the window", () => {
            const rule: import("@/features/freelance-tracker/contracts/types").TimeWindowMultiplierRule =
                {
                    ruleId: testId("rule"),
                    type: "time-window-multiplier",
                    windowStart: "22:00",
                    windowEnd: "06:00",
                    multiplier: 1.5,
                };

            const shifts = RuleEvaluator.splitAtMidnight(
                createTestEntry({
                    startTime: "09:00",
                    endTime: "17:00",
                    rate: 30,
                }),
            );

            const premiums = RuleEvaluator.evaluateTimeWindowMultiplier(
                rule,
                shifts,
            );
            expect(premiums).toHaveLength(0);
        });
    });

    describe("evaluateRules - additive overlaps (non-OT premiums)", () => {
        it("should add premiums from two custom rules applied to the same entry", () => {
            const positionRule: CustomRule = {
                ruleId: testId("custom-position"),
                type: "custom",
                scope: "position",
                condition: { matches: ["Lead"] },
                payout: { type: "multiplier", value: 1.25 },
            };

            const tagRule: CustomRule = {
                ruleId: testId("custom-tag"),
                type: "custom",
                scope: "tag",
                condition: { matches: ["premium"] },
                payout: { type: "multiplier", value: 1.1 },
            };

            const entry = createTestEntry({
                position: "Lead",
                tags: ["premium"],
                startTime: "09:00",
                endTime: "17:00", // 8h
                rate: 50,
            });

            const result = RuleEvaluator.evaluateRules(
                [entry],
                [positionRule, tagRule],
                1,
            );

            // Both rules fired
            expect(
                result.premiums.some((p) => p.ruleId === positionRule.ruleId),
            ).toBe(true);
            expect(
                result.premiums.some((p) => p.ruleId === tagRule.ruleId),
            ).toBe(true);

            // totalPremiumAmount is arithmetic sum of both
            const positionPremium = result.premiums.find(
                (p) => p.ruleId === positionRule.ruleId,
            )!;
            const tagPremium = result.premiums.find(
                (p) => p.ruleId === tagRule.ruleId,
            )!;
            expect(result.totalPremiumAmount).toBeCloseTo(
                (positionPremium.premiumAmount ?? 0) +
                    (tagPremium.premiumAmount ?? 0),
            );

            // Overlap warning emitted containing "additive"
            expect(
                result.unratedWarnings.some((w) =>
                    w.toLowerCase().includes("additive"),
                ),
            ).toBe(true);
        });

        it("should include the entry ID in the overlap warning", () => {
            const ruleA: CustomRule = {
                ruleId: testId("custom-a"),
                type: "custom",
                scope: "position",
                condition: { matches: ["Chef"] },
                payout: { type: "multiplier", value: 1.2 },
            };

            const ruleB: CustomRule = {
                ruleId: testId("custom-b"),
                type: "custom",
                scope: "position",
                condition: { matches: ["Chef"] },
                payout: { type: "multiplier", value: 1.15 },
            };

            const entry = createTestEntry({
                position: "Chef",
                rate: 40,
            });

            const result = RuleEvaluator.evaluateRules(
                [entry],
                [ruleA, ruleB],
                1,
            );

            expect(
                result.unratedWarnings.some((w) => w.includes(entry.entryId)),
            ).toBe(true);
        });
    });

    describe("evaluateRules - empty inputs", () => {
        it("should return empty result for empty entries array", () => {
            const rule: DailyOvertimeRule = {
                ruleId: testId("rule"),
                type: "daily-overtime",
                dailyThresholdHours: 8,
                multiplier: 1.5,
            };

            const result = RuleEvaluator.evaluateRules([], [rule], 1);

            expect(result.premiums).toHaveLength(0);
            expect(result.summaryLines).toHaveLength(0);
            expect(result.totalPremiumAmount).toBe(0);
            expect(result.unratedWarnings).toHaveLength(0);
        });

        it("should return empty result for empty rules array", () => {
            const entry = createTestEntry({
                startTime: "09:00",
                endTime: "18:00",
                rate: 50,
            });

            const result = RuleEvaluator.evaluateRules([entry], [], 1);

            expect(result.premiums).toHaveLength(0);
            expect(result.summaryLines).toHaveLength(0);
            expect(result.totalPremiumAmount).toBe(0);
        });
    });

    describe("evaluateMealPenalty - null rate handling", () => {
        it("should produce non-null premiumAmount for unrated entry with mealPenaltyCount > 0", () => {
            const rule: import("@/features/freelance-tracker/contracts/types").MealPenaltyRule =
                {
                    ruleId: testId("rule"),
                    type: "meal-penalty",
                    description: "Meal Penalty ($30)",
                    penaltyAmount: 30,
                };

            // null rate: meal penalty is flat fee, not rate-dependent
            const entries = [
                createTestEntry({ mealPenaltyCount: 2, rate: null }),
            ];

            const premiums = RuleEvaluator.evaluateMealPenalty(rule, entries);
            expect(premiums).toHaveLength(1);
            expect(premiums[0]!.premiumAmount).toBe(60); // flat: 30 × 2
            expect(premiums[0]!.basePay).toBeNull(); // no rate-based base pay
        });
    });
});
