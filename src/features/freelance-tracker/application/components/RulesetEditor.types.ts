import type { Id } from "@/features/freelance-tracker/contracts/types";

export type OTMode = "none" | "daily" | "weekly";

export type DailyOTForm = {
    ruleId: Id;
    type: "daily-overtime";
    description: string;
    dailyThresholdHours: string;
    multiplier: string;
};

export type WeeklyOTForm = {
    ruleId: Id;
    type: "weekly-overtime";
    description: string;
    weeklyThresholdHours: string;
    multiplier: string;
};

export type MealPenaltyForm = {
    ruleId: Id;
    type: "meal-penalty";
    description: string;
    penaltyAmount: string;
};

export type HolidayRateForm = {
    ruleId: Id;
    type: "holiday-rate";
    description: string;
    holidayDates: string[];
    holidayDateInput: string;
    multiplier: string;
};

export type TimeWindowForm = {
    ruleId: Id;
    type: "time-window-multiplier";
    description: string;
    windowStart: string;
    windowEnd: string;
    multiplier: string;
};

export type CustomRuleForm = {
    ruleId: Id;
    type: "custom";
    description: string;
    scope: "position" | "tag" | "date-range" | "event";
    matchesInput: string;
    startDate: string;
    endDate: string;
    payoutMode: "multiplier" | "advanced";
    multiplierValue: string;
    conditionJson: string;
    payoutJson: string;
};

export type NonOTForm =
    | MealPenaltyForm
    | HolidayRateForm
    | TimeWindowForm
    | CustomRuleForm;
