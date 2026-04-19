/**
 * Unit tests for RulesetSelector
 * Tests effective-dated ruleset selection and single-OT-rule validation
 */

import { describe, it, expect, beforeEach } from "vitest";
import { RulesetSelector } from "../RulesetSelector";
import type {
    Ruleset,
    Result,
} from "@/features/freelance-tracker/contracts/types";
import {
    createId,
    ok,
    err,
} from "@/features/freelance-tracker/contracts/types";
import type { IDataLayer } from "@/features/freelance-tracker/data/dal";
import { testId } from "@/features/freelance-tracker/test-utils/fixtures";

class MockRulesetRepository {
    private rulesets: Map<string, Ruleset> = new Map();

    async getActive(params: {
        organizationId: string;
        onDate: string;
    }): Promise<Result<Ruleset | null>> {
        // Return ruleset with latest effectiveDate <= onDate
        const orgRulesets = Array.from(this.rulesets.values()).filter(
            (r) => r.organizationId === params.organizationId,
        );

        const active = orgRulesets
            .filter((r) => r.effectiveDate <= params.onDate)
            .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))[0];

        return ok(active || null);
    }

    async getById(rulesetId: string): Promise<Result<Ruleset>> {
        const ruleset = this.rulesets.get(rulesetId);
        if (!ruleset) {
            return err({
                type: "notFound",
                entityType: "Ruleset",
                id: rulesetId as any,
            });
        }
        return ok(ruleset);
    }

    async listByOrg(organizationId: string): Promise<Result<Ruleset[]>> {
        const rulesets = Array.from(this.rulesets.values())
            .filter((r) => r.organizationId === organizationId)
            .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate));
        return ok(rulesets);
    }

    async create(
        ruleset: Omit<Ruleset, "rulesetId" | "createdAt">,
    ): Promise<Result<Ruleset>> {
        const full: Ruleset = {
            ...ruleset,
            rulesetId: testId("rule"),
            createdAt: new Date().toISOString(),
        };
        this.rulesets.set(full.rulesetId, full);
        return ok(full);
    }

    async delete(rulesetId: string): Promise<Result<void>> {
        this.rulesets.delete(rulesetId);
        return ok(undefined);
    }

    setMockData(rulesets: Ruleset[]) {
        this.rulesets.clear();
        for (const ruleset of rulesets) {
            this.rulesets.set(ruleset.rulesetId, ruleset);
        }
    }
}

class MockDataLayer implements IDataLayer {
    rulesets = new MockRulesetRepository();

    organizations = {
        async list() {
            return ok([]);
        },
        async get() {
            return err({ type: "io" as const, message: "Not implemented" });
        },
        async create() {
            return err({ type: "io" as const, message: "Not implemented" });
        },
        async update() {
            return err({ type: "io" as const, message: "Not implemented" });
        },
        async delete() {
            return err({ type: "io" as const, message: "Not implemented" });
        },
    };

    entries = {
        async list() {
            return ok([]);
        },
        async create() {
            return err({ type: "io" as const, message: "Not implemented" });
        },
        async getById() {
            return err({ type: "io" as const, message: "Not implemented" });
        },
        async update() {
            return err({ type: "io" as const, message: "Not implemented" });
        },
        async delete() {
            return err({ type: "io" as const, message: "Not implemented" });
        },
    };

    tags = {
        async getAll() {
            return ok([]);
        },
        async record() {
            return err({ type: "io" as const, message: "Not implemented" });
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
            return err({ type: "io" as const, message: "Not implemented" });
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
            return err({ type: "io" as const, message: "Not implemented" });
        },
        async get() {
            return ok(null);
        },
    };

    transaction = {
        async transaction() {
            return err({ type: "io" as const, message: "Not implemented" });
        },
    };

    async initialize() {
        return ok(undefined);
    }

    async dispose() {}
}

describe("RulesetSelector", () => {
    let dal: MockDataLayer;
    let selector: RulesetSelector;

    beforeEach(() => {
        dal = new MockDataLayer();
        selector = new RulesetSelector({ dal });
    });

    describe("getActiveRulesetForDate", () => {
        it("should return the active ruleset for a given date", async () => {
            const orgId = testId("rule");
            const ruleset: Ruleset = {
                rulesetId: testId("rule"),
                organizationId: orgId,
                effectiveDate: "2026-04-01",
                rules: [
                    {
                        ruleId: testId("rule"),
                        type: "daily-overtime",
                        dailyThresholdHours: 8,
                        multiplier: 1.5,
                    },
                ],
                createdAt: new Date().toISOString(),
            };

            dal.rulesets.setMockData([ruleset]);

            const result = await selector.getActiveRulesetForDate(
                orgId,
                "2026-04-14",
            );
            expect(result.success).toBe(true);
            if (!result.success) return;
            expect(result.data).toEqual(ruleset);
        });

        it("should return null if no ruleset is active on the date", async () => {
            const orgId = testId("rule");
            const result = await selector.getActiveRulesetForDate(
                orgId,
                "2026-04-14",
            );
            expect(result.success).toBe(true);
            if (!result.success) return;
            expect(result.data).toBeNull();
        });

        it("should select the most recent effective ruleset for a date", async () => {
            const orgId = testId("rule");
            const ruleset1: Ruleset = {
                rulesetId: testId("rule"),
                organizationId: orgId,
                effectiveDate: "2026-04-01",
                rules: [
                    {
                        ruleId: testId("rule"),
                        type: "daily-overtime",
                        dailyThresholdHours: 8,
                        multiplier: 1.5,
                    },
                ],
                createdAt: new Date().toISOString(),
            };

            const ruleset2: Ruleset = {
                rulesetId: testId("rule"),
                organizationId: orgId,
                effectiveDate: "2026-04-10",
                rules: [
                    {
                        ruleId: testId("rule"),
                        type: "daily-overtime",
                        dailyThresholdHours: 9,
                        multiplier: 1.75,
                    },
                ],
                createdAt: new Date().toISOString(),
            };

            dal.rulesets.setMockData([ruleset1, ruleset2]);

            const result = await selector.getActiveRulesetForDate(
                orgId,
                "2026-04-14",
            );
            expect(result.success).toBe(true);
            if (!result.success) return;
            expect(result.data?.rulesetId).toEqual(ruleset2.rulesetId);
        });
    });

    describe("validateSingleOTRule", () => {
        it("should allow a ruleset with only daily OT", () => {
            const ruleset: Ruleset = {
                rulesetId: testId("rule"),
                organizationId: testId("rule"),
                effectiveDate: "2026-04-01",
                rules: [
                    {
                        ruleId: testId("rule"),
                        type: "daily-overtime",
                        dailyThresholdHours: 8,
                        multiplier: 1.5,
                    },
                ],
                createdAt: new Date().toISOString(),
            };

            const result = selector.validateSingleOTRule(ruleset);
            expect(result.success).toBe(true);
        });

        it("should allow a ruleset with only weekly OT", () => {
            const ruleset: Ruleset = {
                rulesetId: testId("rule"),
                organizationId: testId("rule"),
                effectiveDate: "2026-04-01",
                rules: [
                    {
                        ruleId: testId("rule"),
                        type: "weekly-overtime",
                        weeklyThresholdHours: 40,
                        multiplier: 1.5,
                    },
                ],
                createdAt: new Date().toISOString(),
            };

            const result = selector.validateSingleOTRule(ruleset);
            expect(result.success).toBe(true);
        });

        it("should reject a ruleset with multiple daily OT rules", () => {
            const ruleset: Ruleset = {
                rulesetId: testId("rule"),
                organizationId: testId("rule"),
                effectiveDate: "2026-04-01",
                rules: [
                    {
                        ruleId: testId("rule"),
                        type: "daily-overtime",
                        dailyThresholdHours: 8,
                        multiplier: 1.5,
                    },
                    {
                        ruleId: testId("rule"),
                        type: "daily-overtime",
                        dailyThresholdHours: 10,
                        multiplier: 2.0,
                    },
                ],
                createdAt: new Date().toISOString(),
            };

            const result = selector.validateSingleOTRule(ruleset);
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toMatchObject({
                    message: expect.stringContaining("multiple"),
                });
            }
        });

        it("should reject a ruleset with both daily and weekly OT", () => {
            const ruleset: Ruleset = {
                rulesetId: testId("rule"),
                organizationId: testId("rule"),
                effectiveDate: "2026-04-01",
                rules: [
                    {
                        ruleId: testId("rule"),
                        type: "daily-overtime",
                        dailyThresholdHours: 8,
                        multiplier: 1.5,
                    },
                    {
                        ruleId: testId("rule"),
                        type: "weekly-overtime",
                        weeklyThresholdHours: 40,
                        multiplier: 1.5,
                    },
                ],
                createdAt: new Date().toISOString(),
            };

            const result = selector.validateSingleOTRule(ruleset);
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toMatchObject({
                    message: expect.stringContaining("mix"),
                });
            }
        });

        it("should allow a ruleset with custom rules alongside OT", () => {
            const ruleset: Ruleset = {
                rulesetId: testId("rule"),
                organizationId: testId("rule"),
                effectiveDate: "2026-04-01",
                rules: [
                    {
                        ruleId: testId("rule"),
                        type: "daily-overtime",
                        dailyThresholdHours: 8,
                        multiplier: 1.5,
                    },
                    {
                        ruleId: testId("rule"),
                        type: "custom",
                        scope: "position",
                        condition: { matches: ["Lead"] },
                        payout: { type: "multiplier", value: 1.25 },
                    },
                ],
                createdAt: new Date().toISOString(),
            };

            const result = selector.validateSingleOTRule(ruleset);
            expect(result.success).toBe(true);
        });

        it("should reject a ruleset with multiple weekly-OT rules", () => {
            const ruleset: Ruleset = {
                rulesetId: testId("rule"),
                organizationId: testId("rule"),
                effectiveDate: "2026-04-01",
                rules: [
                    {
                        ruleId: testId("rule"),
                        type: "weekly-overtime",
                        weeklyThresholdHours: 40,
                        multiplier: 1.5,
                    },
                    {
                        ruleId: testId("rule"),
                        type: "weekly-overtime",
                        weeklyThresholdHours: 60,
                        multiplier: 2.0,
                    },
                ],
                createdAt: new Date().toISOString(),
            };

            const result = selector.validateSingleOTRule(ruleset);
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.type).toBe("validation");
                if (result.error.type === "validation") {
                    expect(result.error.message).toMatch(/multiple/i);
                }
            }
        });

        it("should pass validation for an empty rules array", () => {
            const ruleset: Ruleset = {
                rulesetId: testId("rule"),
                organizationId: testId("rule"),
                effectiveDate: "2026-04-01",
                rules: [],
                createdAt: new Date().toISOString(),
            };

            const result = selector.validateSingleOTRule(ruleset);
            expect(result.success).toBe(true);
        });

        it("should pass validation for a ruleset with only non-OT rules", () => {
            const ruleset: Ruleset = {
                rulesetId: testId("rule"),
                organizationId: testId("rule"),
                effectiveDate: "2026-04-01",
                rules: [
                    {
                        ruleId: testId("rule"),
                        type: "meal-penalty",
                        description: "Meal Penalty ($30)",
                        penaltyAmount: 30,
                    },
                    {
                        ruleId: testId("rule"),
                        type: "holiday-rate",
                        description: "Holiday Double Time",
                        holidayDates: ["2026-04-14"],
                        multiplier: 2.0,
                    },
                ],
                createdAt: new Date().toISOString(),
            };

            const result = selector.validateSingleOTRule(ruleset);
            expect(result.success).toBe(true);
        });
    });

    describe("listRulesetsForOrg", () => {
        it("should list all rulesets for an organization in effective date order", async () => {
            const orgId = testId("rule");
            const ruleset1: Ruleset = {
                rulesetId: testId("rule"),
                organizationId: orgId,
                effectiveDate: "2026-04-01",
                rules: [],
                createdAt: new Date().toISOString(),
            };

            const ruleset2: Ruleset = {
                rulesetId: testId("rule"),
                organizationId: orgId,
                effectiveDate: "2026-04-10",
                rules: [],
                createdAt: new Date().toISOString(),
            };

            dal.rulesets.setMockData([ruleset1, ruleset2]);

            const result = await selector.listRulesetsForOrg(orgId);
            expect(result.success).toBe(true);
            if (!result.success) return;
            expect(result.data).toHaveLength(2);
            // Most recent first
            expect(result.data[0]?.rulesetId).toEqual(ruleset2.rulesetId);
        });
    });

    describe("RulesetSelector.selectActiveFromList (static)", () => {
        function makeRulesetInline(id: string, effectiveDate: string): Ruleset {
            return {
                rulesetId: id as ReturnType<typeof testId>,
                organizationId: testId("org"),
                effectiveDate,
                rules: [],
                createdAt: new Date().toISOString(),
            };
        }

        it("should return the ruleset whose effectiveDate exactly matches the query date", () => {
            const rA = makeRulesetInline("rs-a", "2026-04-01");
            const rB = makeRulesetInline("rs-b", "2026-04-15");
            // newest-first list as returned by DAL
            const result = RulesetSelector.selectActiveFromList(
                [rB, rA],
                "2026-04-15",
            );
            expect(result?.rulesetId).toBe("rs-b");
        });

        it("should return the most recent ruleset whose effectiveDate is before the query date", () => {
            const rA = makeRulesetInline("rs-a", "2026-04-01");
            const rB = makeRulesetInline("rs-b", "2026-04-10");
            const result = RulesetSelector.selectActiveFromList(
                [rB, rA],
                "2026-04-14",
            );
            expect(result?.rulesetId).toBe("rs-b");
        });

        it("should return null when the query date is before all rulesets", () => {
            const rA = makeRulesetInline("rs-a", "2026-04-10");
            const result = RulesetSelector.selectActiveFromList(
                [rA],
                "2026-04-01",
            );
            expect(result).toBeNull();
        });

        it("should return null for an empty list", () => {
            const result = RulesetSelector.selectActiveFromList(
                [],
                "2026-04-14",
            );
            expect(result).toBeNull();
        });
    });
});
