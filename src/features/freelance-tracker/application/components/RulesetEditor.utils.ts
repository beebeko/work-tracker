import type { Rule } from "@/features/freelance-tracker/contracts/types";
import { createId } from "@/features/freelance-tracker/contracts/types";
import type {
    DailyOTForm,
    WeeklyOTForm,
    MealPenaltyForm,
    HolidayRateForm,
    TimeWindowForm,
    CustomRuleForm,
    NonOTForm,
    OTMode,
} from "./RulesetEditor.types";

// ── misc helpers ────────────────────────────────────────────────────────────

import type { DalError } from "@/features/freelance-tracker/contracts/types";

export const dalMsg = (e: DalError, fallback: string): string =>
    e.type === "notFound" ? fallback : e.message;

export const formatDate = (iso: string): string => {
    const [y, m, d] = iso.split("-");
    return `${m}/${d}/${y}`;
};

// ── form → domain conversion ────────────────────────────────────────────────

export function otFormToRule(
    form: DailyOTForm | WeeklyOTForm | null,
): Rule | null {
    if (!form) return null;
    if (form.type === "daily-overtime") {
        const t = parseFloat(form.dailyThresholdHours);
        const m = parseFloat(form.multiplier);
        if (isNaN(t) || isNaN(m)) return null;
        return {
            ruleId: form.ruleId,
            type: "daily-overtime",
            description: form.description || undefined,
            dailyThresholdHours: t,
            multiplier: m,
        };
    }
    const t = parseFloat(form.weeklyThresholdHours);
    const m = parseFloat(form.multiplier);
    if (isNaN(t) || isNaN(m)) return null;
    return {
        ruleId: form.ruleId,
        type: "weekly-overtime",
        description: form.description || undefined,
        weeklyThresholdHours: t,
        multiplier: m,
    };
}

export function nonOTFormToRule(form: NonOTForm): Rule | null {
    switch (form.type) {
        case "meal-penalty": {
            const amt = parseFloat(form.penaltyAmount);
            if (isNaN(amt)) return null;
            return {
                ruleId: form.ruleId,
                type: "meal-penalty",
                description: form.description || undefined,
                penaltyAmount: amt,
            };
        }
        case "holiday-rate": {
            const m = parseFloat(form.multiplier);
            if (isNaN(m)) return null;
            return {
                ruleId: form.ruleId,
                type: "holiday-rate",
                description: form.description || undefined,
                holidayDates: form.holidayDates,
                multiplier: m,
            };
        }
        case "time-window-multiplier": {
            const m = parseFloat(form.multiplier);
            if (isNaN(m) || !form.windowStart || !form.windowEnd) return null;
            return {
                ruleId: form.ruleId,
                type: "time-window-multiplier",
                description: form.description || undefined,
                windowStart: form.windowStart,
                windowEnd: form.windowEnd,
                multiplier: m,
            };
        }
        case "custom": {
            const { rule } = customFormToRule(form);
            return rule;
        }
    }
}

export function customFormToRule(form: CustomRuleForm): {
    rule: Rule | null;
    error?: string;
} {
    let conditionAdvanced: Record<string, unknown>;
    let payoutAdvanced: Record<string, unknown>;

    try {
        const parsed = JSON.parse(form.conditionJson || "{}");
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            return {
                rule: null,
                error: "Custom rule condition JSON must be an object.",
            };
        }
        conditionAdvanced = parsed as Record<string, unknown>;
    } catch {
        return { rule: null, error: "Custom rule condition JSON is invalid." };
    }

    try {
        const parsed = JSON.parse(form.payoutJson || "{}");
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            return {
                rule: null,
                error: "Custom rule payout JSON must be an object.",
            };
        }
        payoutAdvanced = parsed as Record<string, unknown>;
    } catch {
        return { rule: null, error: "Custom rule payout JSON is invalid." };
    }

    let condition: Record<string, unknown> = conditionAdvanced;

    if (form.scope === "date-range") {
        if (form.startDate && form.endDate) {
            if (form.startDate > form.endDate) {
                return {
                    rule: null,
                    error: "Custom date range end date must be on or after start date.",
                };
            }
            condition = {
                ...conditionAdvanced,
                startDate: form.startDate,
                endDate: form.endDate,
            };
        } else {
            const hasAdvancedRange =
                typeof conditionAdvanced.startDate === "string" &&
                typeof conditionAdvanced.endDate === "string";
            if (!hasAdvancedRange) {
                return {
                    rule: null,
                    error: "Custom date-range rules require start and end dates.",
                };
            }
        }
    } else {
        const matches = form.matchesInput
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean);

        if (matches.length > 0) {
            condition = { ...conditionAdvanced, matches };
        } else {
            const advancedMatches = conditionAdvanced.matches;
            const hasAdvancedMatches =
                Array.isArray(advancedMatches) && advancedMatches.length > 0;
            if (!hasAdvancedMatches) {
                return {
                    rule: null,
                    error: `Custom ${form.scope} rules require at least one matches value.`,
                };
            }
        }
    }

    let payout: Record<string, unknown>;

    if (form.payoutMode === "multiplier") {
        const value = parseFloat(form.multiplierValue);
        if (isNaN(value) || value <= 0) {
            return {
                rule: null,
                error: "Custom multiplier payout requires a value greater than 0.",
            };
        }
        payout = { ...payoutAdvanced, type: "multiplier", value };
    } else {
        if (Object.keys(payoutAdvanced).length === 0) {
            return {
                rule: null,
                error: "Advanced custom payout JSON is required when payout mode is Advanced JSON.",
            };
        }
        payout = payoutAdvanced;
    }

    return {
        rule: {
            ruleId: form.ruleId,
            type: "custom",
            description: form.description || undefined,
            scope: form.scope,
            condition,
            payout,
        },
    };
}

// ── overlap detection ───────────────────────────────────────────────────────

function timeToMinutes(hhmm: string): number {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
}

function timeWindowsOverlap(a: TimeWindowForm, b: TimeWindowForm): boolean {
    const aStart = timeToMinutes(a.windowStart);
    const aEnd = timeToMinutes(a.windowEnd);
    const bStart = timeToMinutes(b.windowStart);
    const bEnd = timeToMinutes(b.windowEnd);
    // same-day window overlap (does not handle overnight wrap, which would require
    // expanding each window to two day-boundary segments — kept simple here)
    const aEndAdj = aEnd <= aStart ? aEnd + 1440 : aEnd;
    const bEndAdj = bEnd <= bStart ? bEnd + 1440 : bEnd;
    return aStart < bEndAdj && bStart < aEndAdj;
}

export function detectOverlaps(rules: NonOTForm[]): string | null {
    const windows = rules.filter(
        (r): r is TimeWindowForm => r.type === "time-window-multiplier",
    );
    if (windows.length > 1) {
        for (let i = 0; i < windows.length; i++) {
            for (let j = i + 1; j < windows.length; j++) {
                if (timeWindowsOverlap(windows[i], windows[j])) {
                    return "Two or more time-window rules have overlapping coverage. Entries in the overlap will receive the first matching rule only.";
                }
            }
        }
    }

    const holidays = rules.filter(
        (r): r is HolidayRateForm => r.type === "holiday-rate",
    );
    if (holidays.length > 1) {
        const allDates = holidays.flatMap((r) => r.holidayDates);
        const seen = new Set<string>();
        for (const d of allDates) {
            if (seen.has(d))
                return `Holiday date ${d} appears in more than one holiday-rate rule.`;
            seen.add(d);
        }
    }

    return null;
}

// ── blank rule factories ────────────────────────────────────────────────────

export const blankDailyOT = (): DailyOTForm => ({
    ruleId: createId(),
    type: "daily-overtime",
    description: "",
    dailyThresholdHours: "8",
    multiplier: "1.5",
});

export const blankWeeklyOT = (): WeeklyOTForm => ({
    ruleId: createId(),
    type: "weekly-overtime",
    description: "",
    weeklyThresholdHours: "40",
    multiplier: "1.5",
});

export const blankNonOT = (type: NonOTForm["type"]): NonOTForm => {
    const base = { ruleId: createId(), description: "" };
    switch (type) {
        case "meal-penalty":
            return { ...base, type: "meal-penalty", penaltyAmount: "" };
        case "holiday-rate":
            return {
                ...base,
                type: "holiday-rate",
                holidayDates: [],
                holidayDateInput: "",
                multiplier: "2",
            };
        case "time-window-multiplier":
            return {
                ...base,
                type: "time-window-multiplier",
                windowStart: "22:00",
                windowEnd: "06:00",
                multiplier: "1.25",
            };
        case "custom":
            return {
                ...base,
                type: "custom",
                scope: "tag",
                matchesInput: "",
                startDate: "",
                endDate: "",
                payoutMode: "multiplier",
                multiplierValue: "1.1",
                conditionJson: "{}",
                payoutJson: "{}",
            };
    }
};

// ── ruleset → form hydration ────────────────────────────────────────────────

export const toOTMode = (
    rules: Rule[],
): { mode: OTMode; form: DailyOTForm | WeeklyOTForm | null } => {
    const daily = rules.find((rule) => rule.type === "daily-overtime");
    if (daily && daily.type === "daily-overtime") {
        return {
            mode: "daily",
            form: {
                ruleId: daily.ruleId,
                type: "daily-overtime",
                description: daily.description ?? "",
                dailyThresholdHours: String(daily.dailyThresholdHours),
                multiplier: String(daily.multiplier),
            },
        };
    }

    const weekly = rules.find((rule) => rule.type === "weekly-overtime");
    if (weekly && weekly.type === "weekly-overtime") {
        return {
            mode: "weekly",
            form: {
                ruleId: weekly.ruleId,
                type: "weekly-overtime",
                description: weekly.description ?? "",
                weeklyThresholdHours: String(weekly.weeklyThresholdHours),
                multiplier: String(weekly.multiplier),
            },
        };
    }

    return { mode: "none", form: null };
};

export const toNonOTForms = (rules: Rule[]): NonOTForm[] => {
    return rules
        .filter(
            (rule) =>
                rule.type !== "daily-overtime" &&
                rule.type !== "weekly-overtime",
        )
        .map((rule) => {
            if (rule.type === "meal-penalty") {
                return {
                    ruleId: rule.ruleId,
                    type: "meal-penalty",
                    description: rule.description ?? "",
                    penaltyAmount: String(rule.penaltyAmount),
                } as MealPenaltyForm;
            }

            if (rule.type === "holiday-rate") {
                return {
                    ruleId: rule.ruleId,
                    type: "holiday-rate",
                    description: rule.description ?? "",
                    holidayDates: rule.holidayDates,
                    holidayDateInput: "",
                    multiplier: String(rule.multiplier),
                } as HolidayRateForm;
            }

            if (rule.type === "time-window-multiplier") {
                return {
                    ruleId: rule.ruleId,
                    type: "time-window-multiplier",
                    description: rule.description ?? "",
                    windowStart: rule.windowStart,
                    windowEnd: rule.windowEnd,
                    multiplier: String(rule.multiplier),
                } as TimeWindowForm;
            }

            const condition =
                rule.condition && typeof rule.condition === "object"
                    ? rule.condition
                    : {};
            const payout =
                rule.payout && typeof rule.payout === "object"
                    ? rule.payout
                    : {};
            const matches = Array.isArray(condition.matches)
                ? condition.matches
                      .filter(
                          (value): value is string =>
                              typeof value === "string" &&
                              value.trim().length > 0,
                      )
                      .join(", ")
                : "";
            const payoutType =
                typeof payout.type === "string" ? payout.type : undefined;
            const payoutValue =
                typeof payout.value === "number" ? payout.value : 1.1;

            return {
                ruleId: rule.ruleId,
                type: "custom",
                description: rule.description ?? "",
                scope: rule.scope,
                matchesInput: matches,
                startDate:
                    typeof condition.startDate === "string"
                        ? condition.startDate
                        : "",
                endDate:
                    typeof condition.endDate === "string"
                        ? condition.endDate
                        : "",
                payoutMode:
                    payoutType === "multiplier" ? "multiplier" : "advanced",
                multiplierValue: String(payoutValue),
                conditionJson: JSON.stringify(rule.condition ?? {}, null, 2),
                payoutJson: JSON.stringify(rule.payout ?? {}, null, 2),
            } as CustomRuleForm;
        });
};
