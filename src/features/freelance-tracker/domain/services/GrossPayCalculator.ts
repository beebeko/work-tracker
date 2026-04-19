/**
 * GrossPayCalculator
 * Calculates total pay for a period, including rule-based premiums and overtime
 * Integrates with RuleEvaluator for deterministic rule evaluation
 */

import type {
    Id,
    Entry,
    Result,
    Organization,
    Rule,
} from "@/features/freelance-tracker/contracts/types";
import { err, ok } from "@/features/freelance-tracker/contracts/types";
import type { IDataLayer } from "@/features/freelance-tracker/data/dal";
import { RuleEvaluator } from "./RuleEvaluator";
import { RulesetSelector } from "./RulesetSelector";
import type { RulePremium, RuleSummaryLine } from "./RuleEvaluator";
import {
    calculateEntryDurationHours,
    resolveEntryBasePay,
    resolveEntryEffectiveRate,
} from "./paymentMode";

export interface BreakdownItem {
    entryId: Id;
    hours: number;
    rate: number | null;
    pay: number | null;
}

export interface RuleLine {
    ruleId: Id;
    ruleType: string;
    ruleLabel: string;
    role: "overtime" | "penalty" | "multiplier" | "other";
    totalPremiumHours: number;
    totalBasePay: number;
    totalPremiumAmount: number;
    unratedEntryCount: number;
    warnings: string[];
}

export interface GrossPayResult {
    totalPay: number;
    entriesWithoutRate: number;
    totalHours: number;
    breakdown: BreakdownItem[];
    cumulativePay: number; // Total pay across all organizations in this period
    ruleLines: RuleLine[]; // Breakdown by rule (optional, only if rules are active)
    rulePremiumAmount: number; // Total premiums from active rules
    totalWithPremiums: number; // totalPay + rulePremiumAmount
    ruleWarnings: string[]; // Warnings from rule evaluation (overlaps, unrated entries, etc.)
}

export interface GrossPayCalculatorDeps {
    dal: IDataLayer;
}

export class GrossPayCalculator {
    constructor(private deps: GrossPayCalculatorDeps) {}

    /**
     * Calculate gross pay for a period within an organization
     * Includes rule-based premium calculations and cumulative total
     */
    async calculateGrossPayForPeriod(
        organizationId: Id,
        period: { startDate: string; endDate: string },
    ): Promise<Result<GrossPayResult>> {
        // Query entries for this organization in the period
        const entriesResult = await this.deps.dal.entries.list({
            organizationId,
            startDate: period.startDate,
            endDate: period.endDate,
        });

        if (!entriesResult.success) {
            return entriesResult;
        }

        const entries = entriesResult.data;
        const breakdown: BreakdownItem[] = [];
        let totalPay = 0;
        let entriesWithoutRate = 0;
        let totalHours = 0;

        // Process each entry for base pay (without rules)
        for (const entry of entries) {
            const hours = calculateEntryDurationHours(entry);
            totalHours += hours;

            const pay = resolveEntryBasePay(entry, hours);
            if (pay !== null) {
                totalPay += pay;
            } else {
                entriesWithoutRate += 1;
            }

            breakdown.push({
                entryId: entry.entryId,
                hours,
                rate: resolveEntryEffectiveRate(entry),
                pay,
            });
        }

        // Evaluate rules with effective-date-correct ruleset per entry date
        let ruleLines: RuleLine[] = [];
        let rulePremiumAmount = 0;
        let ruleWarnings: string[] = [];

        if (entries.length > 0) {
            const rulesetSelector = new RulesetSelector({ dal: this.deps.dal });
            const allRulesetsResult =
                await rulesetSelector.listRulesetsForOrg(organizationId);

            if (
                allRulesetsResult.success &&
                allRulesetsResult.data.length > 0
            ) {
                const allRulesets = allRulesetsResult.data; // newest-first per DAL contract

                // Get organization workweekStartDay for rule evaluation
                const orgResult =
                    await this.deps.dal.organizations.get(organizationId);
                if (!orgResult.success) {
                    return orgResult;
                }
                const org: Organization = orgResult.data;

                // Group entries by their effective ruleset on each entry's date
                const groups = new Map<
                    string,
                    { entries: Entry[]; rules: Rule[] }
                >();
                for (const entry of entries) {
                    const activeRuleset = RulesetSelector.selectActiveFromList(
                        allRulesets,
                        entry.dateWorked,
                    );
                    if (!activeRuleset || activeRuleset.rules.length === 0)
                        continue;
                    const key = activeRuleset.rulesetId;
                    if (!groups.has(key)) {
                        groups.set(key, {
                            entries: [],
                            rules: activeRuleset.rules,
                        });
                    }
                    groups.get(key)!.entries.push(entry);
                }

                // Evaluate each group and merge resulting summary lines
                const mergedLines = new Map<string, RuleLine>();
                for (const [, group] of groups) {
                    const evalResult = RuleEvaluator.evaluateRules(
                        group.entries,
                        group.rules,
                        org.workweekStartDay,
                    );
                    for (const line of evalResult.summaryLines) {
                        const existing = mergedLines.get(line.ruleId);
                        if (existing) {
                            existing.totalPremiumHours +=
                                line.totalPremiumHours;
                            existing.totalBasePay += line.totalBasePay;
                            existing.totalPremiumAmount +=
                                line.totalPremiumAmount;
                            existing.unratedEntryCount +=
                                line.unratedEntryCount;
                            existing.warnings.push(...line.warnings);
                        } else {
                            mergedLines.set(line.ruleId, {
                                ...line,
                                warnings: [...line.warnings],
                            });
                        }
                    }
                    rulePremiumAmount += evalResult.totalPremiumAmount;
                    ruleWarnings.push(...evalResult.unratedWarnings);
                }

                ruleLines = Array.from(mergedLines.values());
            }
        }

        // Calculate cumulative gross pay across all organizations
        const cumulativePay =
            await this.calculateCumulativePayForPeriod(period);

        if (!cumulativePay.success) {
            return cumulativePay;
        }

        return ok({
            totalPay,
            entriesWithoutRate,
            totalHours,
            breakdown,
            cumulativePay: cumulativePay.data,
            ruleLines,
            rulePremiumAmount,
            totalWithPremiums: totalPay + rulePremiumAmount,
            ruleWarnings,
        });
    }

    /**
     * Calculate total gross pay across all organizations for a period
     * Used internally for cumulative calculation
     */
    private async calculateCumulativePayForPeriod(period: {
        startDate: string;
        endDate: string;
    }): Promise<Result<number>> {
        // Get all organizations
        const orgsResult = await this.deps.dal.organizations.list();
        if (!orgsResult.success) {
            return orgsResult;
        }

        const organizations = orgsResult.data;
        let totalCumulativePay = 0;

        // For each organization, query and sum pay
        for (const org of organizations) {
            const orgEntriesResult = await this.deps.dal.entries.list({
                organizationId: org.organizationId,
                startDate: period.startDate,
                endDate: period.endDate,
            });

            if (!orgEntriesResult.success) {
                return orgEntriesResult;
            }

            const orgEntries = orgEntriesResult.data;

            // Sum pay for entries with non-null rates
            for (const entry of orgEntries) {
                const hours = calculateEntryDurationHours(entry);
                const pay = resolveEntryBasePay(entry, hours);
                if (pay !== null) {
                    totalCumulativePay += pay;
                }
            }
        }

        return ok(totalCumulativePay);
    }
}
