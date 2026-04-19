/**
 * RuleEvaluator
 * Evaluates pay rules against entries for deterministic premium calculations
 * Handles additive overlaps, midnight splitting, and summary breakdowns
 */

import type {
    Entry,
    Rule,
    DailyOvertimeRule,
    WeeklyOvertimeRule,
    MealPenaltyRule,
    HolidayRateRule,
    TimeWindowMultiplierRule,
    CustomRule,
    Id,
} from "@/features/freelance-tracker/contracts/types";
import { resolveEntryEffectiveRate } from "./paymentMode";

/** Represents a single shift potentially split at midnight */
export interface Shift {
    entryId: Id;
    dateWorked: string; // YYYY-MM-DD
    startMinutes: number; // minutes since midnight for this shift's start
    endMinutes: number; // minutes since midnight for this shift's end (may be on next day)
    position: string;
    rate: number | null;
    event: string | null;
    tags: string[];
    notes: string | null;
}

/** Split shift for midnight boundary handling */
export interface SplitShift extends Shift {
    shiftDate: string; // YYYY-MM-DD of this portion of the shift
    durationMinutes: number; // minutes worked on this date
}

/** Premium earned from a single rule application */
export interface RulePremium {
    ruleId: Id;
    ruleType: Rule["type"];
    ruleLabel: string; // User-visible description (e.g., "Daily OT (8h)", "Meal Penalty", custom scope)
    entryId: Id;
    basePay: number | null; // pay without premium (null if rate unresolved)
    premiumAmount: number | null; // additional pay from rule (null if rate unresolved)
    premiumHours: number; // hours subject to premium
    multiplier: number; // multiplier applied or 1.0
}

/** Summary line showing aggregated earnings from a rule */
export interface RuleSummaryLine {
    ruleId: Id;
    ruleType: Rule["type"];
    ruleLabel: string;
    role: "overtime" | "penalty" | "multiplier" | "other";
    totalPremiumHours: number; // total hours subject to this rule
    totalBasePay: number; // base pay before multiplier/premium
    totalPremiumAmount: number; // total additional earnings from rule
    unratedEntryCount: number; // entries with null rate that could apply this rule
    warnings: string[]; // e.g., overlap warnings, unrated warnings
}

export interface RuleEvaluationResult {
    premiums: RulePremium[]; // all premium applications
    summaryLines: RuleSummaryLine[]; // aggregated by rule
    totalPremiumAmount: number; // sum of all premiums (null rates excluded)
    unratedWarnings: string[]; // e.g., "5 unrated entries could apply daily OT"
}

export class RuleEvaluator {
    /**
     * Split entries at midnight boundaries for deterministic daily rule evaluation
     * Returns flattened array of single-day shifts
     */
    static splitAtMidnight(entry: Entry): SplitShift[] {
        const shiftDate = entry.dateWorked;
        const [startHh, startMm] = entry.startTime.split(":").map(Number);
        const [endHh, endMm] = entry.endTime.split(":").map(Number);
        const effectiveRate = resolveEntryEffectiveRate(entry);

        const startMinutes = startHh * 60 + startMm;
        const endMinutes = endHh * 60 + endMm;

        const shifts: SplitShift[] = [];

        if (
            !Number.isFinite(startMinutes) ||
            !Number.isFinite(endMinutes) ||
            startMinutes < 0 ||
            startMinutes > 24 * 60 ||
            endMinutes < 0 ||
            endMinutes > 24 * 60
        ) {
            shifts.push({
                entryId: entry.entryId,
                dateWorked: entry.dateWorked,
                shiftDate,
                startMinutes: 0,
                endMinutes: 0,
                durationMinutes: 0,
                position: entry.position,
                rate: effectiveRate,
                event: entry.event,
                tags: entry.tags,
                notes: entry.notes,
            });
            return shifts;
        }

        // Case 1: shift does not cross midnight
        if (endMinutes > startMinutes) {
            shifts.push({
                entryId: entry.entryId,
                dateWorked: entry.dateWorked,
                shiftDate,
                startMinutes,
                endMinutes,
                durationMinutes: endMinutes - startMinutes,
                position: entry.position,
                rate: effectiveRate,
                event: entry.event,
                tags: entry.tags,
                notes: entry.notes,
            });
        } else if (endMinutes === startMinutes) {
            shifts.push({
                entryId: entry.entryId,
                dateWorked: entry.dateWorked,
                shiftDate,
                startMinutes,
                endMinutes,
                durationMinutes: 0,
                position: entry.position,
                rate: effectiveRate,
                event: entry.event,
                tags: entry.tags,
                notes: entry.notes,
            });
        } else {
            // Case 2: shift crosses midnight (e.g., 22:00 to 6:00)
            // Part 1: current day midnight to end
            const part1Minutes = 24 * 60 - startMinutes;
            shifts.push({
                entryId: entry.entryId,
                dateWorked: shiftDate,
                shiftDate,
                startMinutes,
                endMinutes: 24 * 60, // midnight boundary
                durationMinutes: part1Minutes,
                position: entry.position,
                rate: effectiveRate,
                event: entry.event,
                tags: entry.tags,
                notes: entry.notes,
            });

            // Part 2: next day 00:00 to end time
            const nextDate = new Date(shiftDate + "T00:00:00Z");
            nextDate.setUTCDate(nextDate.getUTCDate() + 1);
            const nextDateStr =
                nextDate.toISOString().split("T")[0] || shiftDate;

            shifts.push({
                entryId: entry.entryId,
                dateWorked: shiftDate,
                shiftDate: nextDateStr,
                startMinutes: 0,
                endMinutes,
                durationMinutes: endMinutes,
                position: entry.position,
                rate: effectiveRate,
                event: entry.event,
                tags: entry.tags,
                notes: entry.notes,
            });
        }

        return shifts;
    }

    /**
     * Evaluate daily overtime rule: hours over dailyThresholdHours earn multiplier
     * Returns array of premiums, one per entry that qualifies
     * Only processes shifts for a single day
     */
    static evaluateDailyOT(
        rule: DailyOvertimeRule,
        shiftsThisDay: SplitShift[],
    ): RulePremium[] {
        const premiums: RulePremium[] = [];
        const thresholdMinutes = rule.dailyThresholdHours * 60;

        // Process each shift, accumulating toward threshold
        let accumulatedMinutes = 0;
        for (const shift of shiftsThisDay) {
            const shiftStart = accumulatedMinutes;
            const shiftEnd = accumulatedMinutes + shift.durationMinutes;
            accumulatedMinutes = shiftEnd;

            // Calculate how many minutes of this shift are in OT
            const premiumMinutesStart = Math.max(shiftStart, thresholdMinutes);
            const premiumMinutesEnd = shiftEnd;
            const premiumMinutes = Math.max(
                0,
                premiumMinutesEnd - premiumMinutesStart,
            );

            if (premiumMinutes > 0) {
                const premiumHours = premiumMinutes / 60;
                const basePay =
                    shift.rate !== null
                        ? (shift.durationMinutes / 60) * shift.rate
                        : null;
                const premiumAmount =
                    shift.rate !== null
                        ? premiumHours * shift.rate * (rule.multiplier - 1)
                        : null;

                premiums.push({
                    ruleId: rule.ruleId,
                    ruleType: "daily-overtime",
                    ruleLabel:
                        rule.description ??
                        `Daily OT (${rule.dailyThresholdHours}h @ ${rule.multiplier}x)`,
                    entryId: shift.entryId,
                    basePay,
                    premiumAmount,
                    premiumHours,
                    multiplier: rule.multiplier,
                });
            }
        }

        return premiums;
    }

    /**
     * Evaluate weekly overtime rule: hours over weeklyThresholdHours earn multiplier
     * workweekStartDay: 1=Monday, 7=Sunday
     * Returns array of premiums, one per entry that qualifies in the week
     */
    static evaluateWeeklyOT(
        rule: WeeklyOvertimeRule,
        shiftsThisWeek: SplitShift[],
        workweekStartDay: number,
    ): RulePremium[] {
        const premiums: RulePremium[] = [];
        const thresholdMinutes = rule.weeklyThresholdHours * 60;

        // Sort shifts by date to process in order
        const sorted = [...shiftsThisWeek].sort((a, b) =>
            a.shiftDate.localeCompare(b.shiftDate),
        );

        let accumulatedMinutes = 0;
        for (const shift of sorted) {
            const shiftStart = accumulatedMinutes;
            const shiftEnd = accumulatedMinutes + shift.durationMinutes;
            accumulatedMinutes = shiftEnd;

            // Calculate premium minutes for this shift
            const premiumMinutesStart = Math.max(shiftStart, thresholdMinutes);
            const premiumMinutesEnd = shiftEnd;
            const premiumMinutes = Math.max(
                0,
                premiumMinutesEnd - premiumMinutesStart,
            );

            if (premiumMinutes > 0) {
                const premiumHours = premiumMinutes / 60;
                const basePay =
                    shift.rate !== null
                        ? (shift.durationMinutes / 60) * shift.rate
                        : null;
                const premiumAmount =
                    shift.rate !== null
                        ? premiumHours * shift.rate * (rule.multiplier - 1)
                        : null;

                premiums.push({
                    ruleId: rule.ruleId,
                    ruleType: "weekly-overtime",
                    ruleLabel:
                        rule.description ??
                        `Weekly OT (${rule.weeklyThresholdHours}h @ ${rule.multiplier}x)`,
                    entryId: shift.entryId,
                    basePay,
                    premiumAmount,
                    premiumHours,
                    multiplier: rule.multiplier,
                });
            }
        }

        return premiums;
    }

    /**
     * Evaluate custom rule: match scope condition and apply payout
     * Scope can be: position, tag, date-range, event
     * Condition and payout are predefined DSL blocks
     */
    static evaluateCustomRule(
        rule: CustomRule,
        shifts: SplitShift[],
    ): RulePremium[] {
        const premiums: RulePremium[] = [];

        for (const shift of shifts) {
            let matches = false;

            // Match on scope
            switch (rule.scope) {
                case "position":
                    if (
                        rule.condition &&
                        typeof rule.condition === "object" &&
                        "matches" in rule.condition
                    ) {
                        const matches_val = rule.condition.matches;
                        if (
                            Array.isArray(matches_val) &&
                            matches_val.includes(shift.position)
                        ) {
                            matches = true;
                        }
                    }
                    break;
                case "tag":
                    if (
                        rule.condition &&
                        typeof rule.condition === "object" &&
                        "matches" in rule.condition
                    ) {
                        const matches_val = rule.condition.matches;
                        if (
                            Array.isArray(matches_val) &&
                            shift.tags.some((tag) => matches_val.includes(tag))
                        ) {
                            matches = true;
                        }
                    }
                    break;
                case "event":
                    if (
                        rule.condition &&
                        typeof rule.condition === "object" &&
                        "matches" in rule.condition
                    ) {
                        const matches_val = rule.condition.matches;
                        if (
                            shift.event &&
                            Array.isArray(matches_val) &&
                            matches_val.includes(shift.event)
                        ) {
                            matches = true;
                        }
                    }
                    break;
                case "date-range":
                    // date-range condition: { startDate, endDate }
                    if (
                        rule.condition &&
                        typeof rule.condition === "object" &&
                        "startDate" in rule.condition &&
                        "endDate" in rule.condition
                    ) {
                        const sd = rule.condition.startDate as string;
                        const ed = rule.condition.endDate as string;
                        if (shift.shiftDate >= sd && shift.shiftDate <= ed) {
                            matches = true;
                        }
                    }
                    break;
            }

            if (matches) {
                // Apply payout DSL
                let multiplier = 1.0;
                let scope_label = rule.scope;

                if (
                    rule.payout &&
                    typeof rule.payout === "object" &&
                    "type" in rule.payout
                ) {
                    const payout_type = rule.payout.type;
                    if (
                        payout_type === "multiplier" &&
                        "value" in rule.payout
                    ) {
                        multiplier = (rule.payout.value as number) || 1.0;
                    }
                    // flat-fee could be added but typically per-entry, not hours-based
                }

                const premiumHours = shift.durationMinutes / 60;
                const basePay =
                    shift.rate !== null ? premiumHours * shift.rate : null;
                const premiumAmount =
                    shift.rate !== null
                        ? premiumHours * shift.rate * (multiplier - 1)
                        : null;

                premiums.push({
                    ruleId: rule.ruleId,
                    ruleType: "custom",
                    ruleLabel: rule.description ?? `Custom (${scope_label})`,
                    entryId: shift.entryId,
                    basePay,
                    premiumAmount,
                    premiumHours,
                    multiplier,
                });
            }
        }

        return premiums;
    }

    /**
     * Overlap in minutes between two minute-ranges [aStart, aEnd) and [bStart, bEnd).
     */
    private static minutesOverlap(
        aStart: number,
        aEnd: number,
        bStart: number,
        bEnd: number,
    ): number {
        return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
    }

    /**
     * Evaluate meal penalty rule: flat penaltyAmount × entry.mealPenaltyCount.
     * Operates on Entry directly since mealPenaltyCount is an entry-level marker.
     */
    static evaluateMealPenalty(
        rule: MealPenaltyRule,
        entries: Entry[],
    ): RulePremium[] {
        const premiums: RulePremium[] = [];

        for (const entry of entries) {
            const count = entry.mealPenaltyCount ?? 0;
            if (count > 0) {
                premiums.push({
                    ruleId: rule.ruleId,
                    ruleType: "meal-penalty",
                    ruleLabel: rule.description ?? "Meal Penalty",
                    entryId: entry.entryId,
                    basePay: null, // flat fee; not rate-dependent
                    premiumAmount: rule.penaltyAmount * count,
                    premiumHours: 0, // flat fee, not hours-based
                    multiplier: 1.0,
                });
            }
        }

        return premiums;
    }

    /**
     * Evaluate holiday rate rule: applies multiplier to all hours on holiday dates.
     */
    static evaluateHolidayRate(
        rule: HolidayRateRule,
        shifts: SplitShift[],
    ): RulePremium[] {
        const premiums: RulePremium[] = [];
        const holidaySet = new Set(rule.holidayDates);

        for (const shift of shifts) {
            if (holidaySet.has(shift.shiftDate)) {
                const premiumHours = shift.durationMinutes / 60;
                const basePay =
                    shift.rate !== null ? premiumHours * shift.rate : null;
                const premiumAmount =
                    shift.rate !== null
                        ? premiumHours * shift.rate * (rule.multiplier - 1)
                        : null;

                premiums.push({
                    ruleId: rule.ruleId,
                    ruleType: "holiday-rate",
                    ruleLabel:
                        rule.description ??
                        `Holiday Rate (${rule.multiplier}x)`,
                    entryId: shift.entryId,
                    basePay,
                    premiumAmount,
                    premiumHours,
                    multiplier: rule.multiplier,
                });
            }
        }

        return premiums;
    }

    /**
     * Evaluate time window multiplier: applies multiplier to hours within windowStart–windowEnd.
     * If windowEnd <= windowStart the window wraps overnight (e.g. 22:00–06:00).
     */
    static evaluateTimeWindowMultiplier(
        rule: TimeWindowMultiplierRule,
        shifts: SplitShift[],
    ): RulePremium[] {
        const premiums: RulePremium[] = [];
        const [wsH = 0, wsM = 0] = rule.windowStart.split(":").map(Number);
        const [weH = 0, weM = 0] = rule.windowEnd.split(":").map(Number);
        const windowStartMinutes = wsH * 60 + wsM;
        const windowEndMinutes = weH * 60 + weM;
        const wrapsOvernight = windowEndMinutes <= windowStartMinutes;

        for (const shift of shifts) {
            let premiumMinutes: number;
            if (wrapsOvernight) {
                // Window covers [0, windowEnd) ∪ [windowStart, 1440)
                premiumMinutes =
                    RuleEvaluator.minutesOverlap(
                        shift.startMinutes,
                        shift.endMinutes,
                        0,
                        windowEndMinutes,
                    ) +
                    RuleEvaluator.minutesOverlap(
                        shift.startMinutes,
                        shift.endMinutes,
                        windowStartMinutes,
                        24 * 60,
                    );
            } else {
                // Contiguous window [windowStart, windowEnd)
                premiumMinutes = RuleEvaluator.minutesOverlap(
                    shift.startMinutes,
                    shift.endMinutes,
                    windowStartMinutes,
                    windowEndMinutes,
                );
            }

            if (premiumMinutes > 0) {
                const premiumHours = premiumMinutes / 60;
                const basePay =
                    shift.rate !== null ? premiumHours * shift.rate : null;
                const premiumAmount =
                    shift.rate !== null
                        ? premiumHours * shift.rate * (rule.multiplier - 1)
                        : null;

                premiums.push({
                    ruleId: rule.ruleId,
                    ruleType: "time-window-multiplier",
                    ruleLabel:
                        rule.description ??
                        `Time Window (${rule.windowStart}–${rule.windowEnd} @ ${rule.multiplier}x)`,
                    entryId: shift.entryId,
                    basePay,
                    premiumAmount,
                    premiumHours,
                    multiplier: rule.multiplier,
                });
            }
        }

        return premiums;
    }

    /**
     * Evaluate all rules for a set of entries and generate summary
     * entries: array of Entry to evaluate
     * rules: array of Rule to evaluate
     * workweekStartDay: 1=Monday, 7=Sunday for weekly OT
     * Returns detailed premiums and summary lines, with additive overlap warnings
     */
    static evaluateRules(
        entries: Entry[],
        rules: Rule[],
        workweekStartDay: number,
    ): RuleEvaluationResult {
        const premiums: RulePremium[] = [];
        const summaryLines: RuleSummaryLine[] = [];
        const warnings: string[] = [];

        // Split all entries at midnight for daily processing
        const allShifts = entries.flatMap((entry) =>
            this.splitAtMidnight(entry),
        );

        // Group shifts by date for daily OT evaluation
        const shiftsByDate = new Map<string, SplitShift[]>();
        for (const shift of allShifts) {
            if (!shiftsByDate.has(shift.shiftDate)) {
                shiftsByDate.set(shift.shiftDate, []);
            }
            shiftsByDate.get(shift.shiftDate)!.push(shift);
        }

        // Track which entries have been subject to multiple rules (overlap detection)
        const entryRuleCount = new Map<Id, number>();
        for (const entry of entries) {
            // Count how many rule types could apply to this entry
            let ruleCount = 0;
            for (const rule of rules) {
                if (
                    rule.type === "daily-overtime" ||
                    rule.type === "weekly-overtime"
                ) {
                    ruleCount++;
                } else if (rule.type === "custom") {
                    // Custom rules might apply; simplified: count as potential
                    ruleCount++;
                }
            }
            if (ruleCount > 1) {
                entryRuleCount.set(entry.entryId, ruleCount);
            }
        }

        // Evaluate each rule
        for (const rule of rules) {
            const rulePremiums: RulePremium[] = [];

            if (rule.type === "daily-overtime") {
                // Evaluate daily OT for each day
                for (const [, shiftsThisDay] of shiftsByDate) {
                    const dayPremiums = this.evaluateDailyOT(
                        rule,
                        shiftsThisDay,
                    );
                    rulePremiums.push(...dayPremiums);
                }
            } else if (rule.type === "weekly-overtime") {
                // Evaluate weekly OT for all shifts
                const weekPremiums = this.evaluateWeeklyOT(
                    rule,
                    allShifts,
                    workweekStartDay,
                );
                rulePremiums.push(...weekPremiums);
            } else if (rule.type === "meal-penalty") {
                // Evaluate meal penalty per entry (flat fee × mealPenaltyCount)
                const mealPremiums = this.evaluateMealPenalty(rule, entries);
                rulePremiums.push(...mealPremiums);
            } else if (rule.type === "holiday-rate") {
                // Evaluate holiday rate for shifts on holiday dates
                const holidayPremiums = this.evaluateHolidayRate(
                    rule,
                    allShifts,
                );
                rulePremiums.push(...holidayPremiums);
            } else if (rule.type === "time-window-multiplier") {
                // Evaluate time window multiplier for hours within the window
                const windowPremiums = this.evaluateTimeWindowMultiplier(
                    rule,
                    allShifts,
                );
                rulePremiums.push(...windowPremiums);
            } else if (rule.type === "custom") {
                // Evaluate custom rule for all shifts
                const customPremiums = this.evaluateCustomRule(rule, allShifts);
                rulePremiums.push(...customPremiums);
            }

            // Add to global premiums
            premiums.push(...rulePremiums);

            // Build summary line for this rule
            if (rulePremiums.length > 0) {
                let totalPremiumHours = 0;
                let totalBasePay = 0;
                let totalPremiumAmount = 0;
                let unratedCount = 0;
                const ruleWarnings: string[] = [];

                for (const premium of rulePremiums) {
                    totalPremiumHours += premium.premiumHours;
                    if (premium.basePay !== null) {
                        totalBasePay += premium.basePay;
                    }
                    if (premium.premiumAmount !== null) {
                        totalPremiumAmount += premium.premiumAmount;
                    } else {
                        unratedCount++;
                    }
                }

                // Warn about overlap if multiple rules apply to same entries
                if (
                    Array.from(entryRuleCount.values()).some(
                        (count) => count > 1,
                    )
                ) {
                    ruleWarnings.push(
                        "Overlapping rules detected; premiums are additive",
                    );
                }

                if (unratedCount > 0) {
                    ruleWarnings.push(
                        `${unratedCount} entries lack rates for this premium`,
                    );
                }

                const role: RuleSummaryLine["role"] =
                    rule.type === "daily-overtime" ||
                    rule.type === "weekly-overtime"
                        ? "overtime"
                        : rule.type === "meal-penalty"
                          ? "penalty"
                          : rule.type === "custom" && rule.scope === "event"
                            ? "penalty"
                            : "multiplier";

                summaryLines.push({
                    ruleId: rule.ruleId,
                    ruleType: rule.type,
                    ruleLabel: rulePremiums[0]!.ruleLabel,
                    role,
                    totalPremiumHours,
                    totalBasePay,
                    totalPremiumAmount,
                    unratedEntryCount: unratedCount,
                    warnings: ruleWarnings,
                });
            }
        }

        // Detect additive overlap: same entry subject to multiple rules
        for (const [entryId, count] of entryRuleCount) {
            if (count > 1) {
                warnings.push(
                    `Entry ${entryId} subject to multiple rules (additive)`,
                );
            }
        }

        let totalPremiumAmount = 0;
        for (const premium of premiums) {
            if (premium.premiumAmount !== null) {
                totalPremiumAmount += premium.premiumAmount;
            }
        }

        return {
            premiums,
            summaryLines,
            totalPremiumAmount,
            unratedWarnings: warnings,
        };
    }
}
